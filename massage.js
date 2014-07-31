var request     = require('request');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var Streamifier = require('streamifier');
var Url         = require('url');
var Fs          = require('fs');
var glob        = require('glob');
var _           = require('lodash');
var uuid        = require('uuid');
var temp        = require('temp');
var async       = require('async');

/* Cleanup temp files */
temp.track();

function InvalidFileUrl () {
  this.name = 'Invalid File URL';
  this.message = 'URL provided is invalid';
}

InvalidFileUrl.prototype = Object.create(Error.prototype);
InvalidFileUrl.prototype.constructor = InvalidFileUrl;

function InvalidPdfFile () {
  this.name = 'Invalid PDF File';
  this.message = 'PDF file provided is invalid. Please contact support@lob.com';
}

InvalidPdfFile.prototype = Object.create(Error.prototype);
InvalidPdfFile.prototype.constructor = InvalidPdfFile;

function InvalidRotationDegrees () {
  this.name = 'Invalid Rotation Degrees';
  this.message = 'Rotation degrees must be 90, 180, 270';
}

InvalidRotationDegrees.prototype = Object.create(Error.prototype);
InvalidRotationDegrees.prototype.constructor = InvalidRotationDegrees;

exports.Errors = {
  invalidFileUrl: InvalidFileUrl,
  invalidPdfFile: InvalidPdfFile,
  invalidRotationDegrees: InvalidRotationDegrees
};

exports.getMetaData = function (buffer, cb) {
  var fileStream = Streamifier.createReadStream(buffer);
  var identify   = spawn('identify',['-format','%m,%[fx:w/72],%[fx:h/72],%n,',
    '-']);
  identify.stdout.on('data', function (data) {
    var meta = data.toString().split(',');
    var metaObj = {
      fileType: meta[0],
      width: parseFloat(meta[1]),
      length: parseFloat(meta[2]),
      numPages: parseFloat(meta[3])
    };
    return cb(null, metaObj);
  });

  identify.stderr.on('data', function (data) {
    /* istanbul ignore else */
    // check if there are error messages
    if (data.toString().substr(0, 8) === 'identify') {
      return cb(new InvalidPdfFile());
    }
  });
  fileStream.pipe(identify.stdin);
};


/**
* Takes a string/buffer and checks if it is a valid URL
* @param {String} url - url to validate
*/
exports.validateUrl = function (url, cb) {
  if (
    !url ||
    (url instanceof Buffer) ||
    Url.parse(url).protocol === 'invalid:'
  ) {
    return cb(new InvalidFileUrl());
  } else {
    return cb(null, url);
  }
};

/**
* Takes either a buffer or request params
* @param {Object} params - URL or buffer
*/
exports.getBuffer = function (file, cb) {
  if (file instanceof Buffer) {
    return cb(null, file);
  }

  if (!Url.parse(file).protocol) {
    return cb(new InvalidFileUrl());
  }

  var defaults = {
    method: 'GET',
    timeout: 10000,
    encoding: null,
  };

  request(options, function (err, res) {
    if (err) {
      return cb(new InvalidFileUrl());
    } else {
      return cb(null, res.body);
    }
  });
};

/**
* Combine two files into a single a file
* @param {Buffer} buffer1 - first file to combine
* @param {Buffer} buffer2 - second file to combine
*/
exports.merge = function (buffer1, buffer2, cb) {
  // make 2 temp files
  async.parallel({
    file1: function (done) {
      temp.open({prefix: 'merge', suffix: '.pdf'},
        function (err, file) {
          if (err) {
            done(err);
          } else {
            Fs.writeFile(file.path, buffer1, function (err) {
              if (err) {
                done(err);
              } else {
                done(null, file);
              }
            });
          }
        });
     },
    file2: function (done) {
      temp.open({prefix: 'merge', suffix: '.pdf'},
        function (err, file) {
          if (err) {
            done(err);
          } else {
            Fs.writeFile(file.path, buffer2, function (err) {
              if (err) {
                done(err);
              } else {
                done(null, file);
              }
            });
          }
        });
     },
    merged: function (done) {
      temp.open({prefix: 'merge', suffix: '.pdf'}, done);
    }
  }, function (err, res) {
    var file1 = res.file1;
    var file2 = res.file2;
    var merged = res.merged;
    var cmd = 'pdftk' + ' ' + file1.path + ' ' + file2.path + ' ' +
      'cat output' + ' ' + merged.path;
    var merge = exec(cmd);
    merge.stderr.on('data', function (data) {
      return cb(new Error(data.toString()));
    });
    merge.on('close', function (code) {
      if (code === 0) {
        Fs.readFile(merged.path, function (err, buf) {
          if (err) {
            cb(err);
          } else {
            cb(null, buf);
          }
          async.parallel([
            function (done) {
              Fs.unlink(file1.path, done);
            },
            function (done) {
              Fs.unlink(file2.path, done);
            },
            function (done) {
              Fs.unlink(merged.path, done);
            }
          ]);
        });
      } else {
        cb(new Error('pdftk merge operation has failed'));
      }
    });
  });
};

/**
* Takes a PDF buffer, rotates it clockwise and returns as buffer
* @param {Buffer} buffer - PDF file buffer
* @param {number} degrees - degrees to rotate PDF
*/
exports.rotatePdf = function (buffer, degrees, cb) {
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    cb(new InvalidRotationDegrees());
  }
  async.parallel({
    infile: function (done) {
      temp.open({prefix: 'rotate', suffix: '.pdf'},
        function (err, file) {
          Fs.writeFile(file.path, buffer, function (err) {
            if (err) {
              done(err);
            } else {
              done(null, file);
            }
          });
        });
    },
    outfile: function (done) {
      temp.open({prefix: 'rotate', suffix: '.pdf'}, done);
    }
  }, function (err, res) {
    var infile  = res.infile;
    var outfile = res.outfile;
    var cmd = 'convert -rotate ' + degrees + ' -density 300 ' +
      infile.path + ' ' + outfile.path;
    var rotate = exec(cmd);
    rotate.on('close', function (code) {
      if (code === 0) {
        Fs.readFile(outfile.path, cb);
      } else {
        cb(new Error('pdftk rotate operation has failed'));
      }
      async.parallel([
        function (done) {
          Fs.unlink(infile.path, done);
        },
        function (done) {
          Fs.unlink(outfile.path, done);
        }
      ]);
    });
  });
};

/**
  * Takes a multipage pdf buffer and returns an array of 1-page pdf buffers
  * (Sorted by page number)
  * @author - Grayson Chao
  * @param {Buffer} pdf PDF file buffer
  */
exports.burstPdf = function (buffer, cb) {
  temp.open({prefix: 'burst', suffix: '.pdf'},
    function (err, file) {
      Fs.writeFile(file.path, buffer, function (err) {
        if (err) {
          cb(err);
          temp.cleanup();
        } else {
          burst(file);
        }
      });
    });

  function burst (file) {
    var cmd = 'pdftk ' + file.path +
      ' burst output ' + file.path + '_page_%03d';
    var pdftk = exec(cmd);
    pdftk.on('close', function (code) {
      if (code === 0) {
        readPages(file);
      } else {
        cb(new Error('pdftk burst operation has failed'));
        temp.cleanup();
      }
    });
  }

  function readPages(infile) {
    glob(infile.path + '_page_*', function (err, filenames) {
      var sortedNames = _.sortBy(filenames, function (filename) {
        return parseInt(filename.slice(filename.length - 3));
      });
      async.map(sortedNames, function (file, done) {
        Fs.readFile(file, done);
      }, function (err, res) {
        if (err) {
          cb(err);
        } else {
          cb(null, res);
        }
        //cleanup all temp files
        async.parallel(sortedNames.concat(infile.path)
          .map(function (path) {
            return (function (done) {
              Fs.unlink(path, done);
            });
          })
        );
      });
    });
  }
};

/**
  * Takes a pdf and resizes it to thumbnail size.
  * Returns a buffer of a PNG of the thumbnail.
  * @author - Grayson Chao
  * @param {Buffer} buffer PDF file buffer
  * @param {Number} size an ImageMagick geometry string: width[xheight][+offset]
  */
exports.generateThumbnail = function (buffer, size, cb) {
  async.parallel({
    infile: function (done) {
      temp.open({prefix: 'rotate', suffix: '.pdf'},
        function (err, file) {
          Fs.writeFile(file.path, buffer, function (err) {
            if (err) {
              done(err);
            } else {
              done(null, file);
            }
          });
        });
    },
    outfile: function (done) {
      temp.open({prefix: 'rotate', suffix: '.png'}, done);
    }
  }, function (err, res) {
    var infile = res.infile;
    var outfile = res.outfile;
    var cmd = 'convert -density 300x300 -resize ' + size + ' ' +
      infile.path + ' ' + outfile.path;
    var convert = exec(cmd);
    convert.stderr.on('data', function (d) {
      return cb(new Error(d.toString()));
    });
    convert.on('close', function (code) {
      if (code === 0) {
        Fs.readFile(outfile.path, cb);
      } else {
        cb(new Error('imagemagick convert operation has failed'));
        async.parallel([
          function (done) {
            Fs.unlink(infile.path, done);
          },
          function (done) {
            Fs.unlink(outfile.path, done);
          }
        ]);
      }
    });
  });
};
