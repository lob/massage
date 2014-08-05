var request     = require('request');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var Streamifier = require('streamifier');
var Url         = require('url');
var Fs          = require('fs');
var glob        = require('glob');
var _           = require('lodash');
var temp        = require('temp');
var async       = require('async');

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

function ImageProcessingFailure () {
  this.name = 'Image Processing Failure';
  this.message = 'Imagemagick or pdftk exited with a non-zero exit code.';
}

ImageProcessingFailure.prototype = Object.create(Error.prototype);
ImageProcessingFailure.prototype.constructor = ImageProcessingFailure;

exports.Errors = {
  invalidFileUrl: InvalidFileUrl,
  invalidPdfFile: InvalidPdfFile,
  invalidRotationDegrees: InvalidRotationDegrees
};

/**
  * Return a function which takes a callback, writes buffer to a temp file,
  * then passes the temp file to the callback on success.
  * The temp function is passed the (optional) options object.
  * @author - Grayson Chao
  * @param {Buffer} buffer
  */
exports.writeTemp = function (buffer, options) {
  return function (done) {
    temp.open(options, function (err, file) {
      Fs.writeFile(file.path, buffer, function (err) {
        done(err, file);
      });
    });
  };
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
    file1: exports.writeTemp(buffer1, {prefix: 'merge', suffix: '.pdf'}),
    file2: exports.writeTemp(buffer2, {prefix: 'merge', suffix: '.pdf'}),
    merged: exports.writeTemp(new Buffer(0),
      {prefix: 'merge', suffix: '.pdf'})
  }, function (err, res) {
    var file1 = res.file1;
    var file2 = res.file2;
    var merged = res.merged;
    var cmd = 'pdftk' + ' ' + file1.path + ' ' + file2.path + ' ' +
      'cat output' + ' ' + merged.path;
    exec(cmd, function (err, stdout, stderr) {
      if (err || stderr) {
        cb(new ImageProcessingFailure());
      } else {
        Fs.readFile(merged.path, function (err, buf) {
          cb(err, buf);
          async.each([file1.path, file2.path, merged.path], Fs.unlink);
        });
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
    infile: exports.writeTemp(buffer,
      {prefix: 'rotate', suffix: '.pdf'}),
    outfile: exports.writeTemp(new Buffer(0),
      {prefix: 'rotate', suffix: '.pdf'})
  }, function (err, res) {
    var infile  = res.infile;
    var outfile = res.outfile;
    var cmd = 'convert -rotate ' + degrees + ' -density 300 ' +
      infile.path + ' ' + outfile.path;
    exec(cmd, function (err, stdout, stderr) {
      if (err || stderr) {
        cb(new ImageProcessingFailure());
      } else {
        Fs.readFile(outfile.path, function (err, buf) {
          cb(err, buf);
          async.each([infile.path, outfile.path], Fs.unlink);
        });
      }
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
  var tempFn = exports.writeTemp(buffer, {prefix: 'burst', suffix: '.pdf'});

  function burst (err, file) {
    var cmd = 'pdftk ' + file.path +
      ' burst output ' + file.path + '_page_%03d';
    exec(cmd, function (err, stdout, stderr) {
      if (err || stderr) {
        cb(new ImageProcessingFailure());
      } else {
        readPages(file);
      }
    });
  }

  function readPages(infile) {
    glob(infile.path + '_page_*', function (err, filenames) {
      var sortedNames = _.sortBy(filenames, function (filename) {
        return parseInt(filename.slice(filename.length - 3));
      });
      async.map(sortedNames, Fs.readFile, function (err, buf) {
        cb(err, buf);
        async.each(sortedNames.concat(infile.path), Fs.unlink);
      });
    });
  }

  tempFn(burst);
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
    infile: exports.writeTemp(buffer,
      {prefix: 'thumb', suffix: '.pdf'}),
    outfile: exports.writeTemp(new Buffer(0),
      {prefix: 'thumb', suffix: '.png'})
  }, function (err, res) {
    var infile = res.infile;
    var outfile = res.outfile;
    var cmd = 'convert -density 300x300 -resize ' + size + ' ' +
      infile.path + ' ' + outfile.path;
    exec(cmd, function (err, stdout, stderr) {
      if (err || stderr) {
        cb(new ImageProcessingFailure());
      } else {
        Fs.readFile(outfile.path, function (err, buf) {
          cb(err, buf);
          async.each([infile.path, outfile.path], Fs.unlink);
        });
      }
    });
  });
};
