var Promise     = require('bluebird');
var request     = require('request');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var Streamifier = require('streamifier');
var Url         = require('url');
var fs          = require('fs');
var sha1        = require('sha1');
var glob        = require('glob');
var _           = require('lodash');
var uuid        = require('uuid');

/* Promisify core API methods */
var pwrite  = Promise.promisify(fs.writeFile);
var punlink = Promise.promisify(fs.unlink);
var pexec   = Promise.promisify(exec);
var pglob   = Promise.promisify(glob);
var preq    = Promise.promisify(request);

var internals = {};

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

/** Return a 16-character unique identifier.
 * @author - Grayson Chao
 */
var getUUID = function () {
  return sha1(uuid.v4().toString()).slice(0, 15);
};

/**
* Takes a buffer and returns the relevant metadata
* @author Peter Nagel
* @param {Stream/Buffer} file - readable file stream or buffer
*/
exports.getMetaData = function (file) {
  file = (file instanceof Buffer) ? Streamifier.createReadStream(file) : file;
  return new Promise(function (resolve, reject) {
    var identify   = spawn('identify',['-format','%m,%[fx:w],%[fx:h],%n,',
      '-']);
    identify.stdout.on('data', function (data) {
      var meta = data.toString().split(',');
      var metaObj = {
        fileType: meta[0],
        width: parseFloat(meta[1]),
        length: parseFloat(meta[2]),
        numPages: parseFloat(meta[3])
      };
      resolve(metaObj);
    });
    identify.stderr.on('data', function (data) {
      /* istanbul ignore else */
      // check if there are error messages
      if (data.toString().substr(0, 8) === 'identify') {
        reject(new InvalidPdfFile());
      }
    });
    file.pipe(identify.stdin);
  });
};

/**
* Takes a string/buffer and checks if it is a valid URL
* @param {String} url - url to validate
*/
exports.validateUrl = Promise.method(function (url) {
  if (!url || (typeof url) !== 'string' || !Url.parse(url).protocol) {
    throw new InvalidFileUrl();
  } else {
    return url;
  }
});

/**
* Takes either a buffer or request params
* @param {Object} params - URL or buffer
*/
exports.getBuffer = Promise.method(function (params) {
  if (params instanceof Buffer) {
    return params;
  }

  /* istanbul ignore else*/
  if (typeof params === 'string') {
    params = {url: params};
  }

  if (!Url.parse(params.url).protocol) {
    throw new InvalidFileUrl();
  }

  var defaults = {
    method: 'GET',
    timeout: 10000,
    encoding: null,
  };

  Object.keys(defaults).forEach(function (name) {
    /* istanbul ignore else*/
    if (!params.hasOwnProperty(name)) {
      params[name] = defaults[name];
    }
  });

  return preq(params)
  .then(function (res) {
    return res[0].body;
  })
  .catch(function () {
    throw new InvalidFileUrl();
  });
});

/**
 * @author Peter Nagel
 * @param {String} url
 * @returns {Stream}
 */
exports.getStream = function (url) {
  return preq({
    method: 'HEAD',
    url: url
  })
  .then(function (res) {
    if (res[0].statusCode !== 200) {
      throw new InvalidFileUrl();
    } else {
      return request(url);
    }
  })
  .catch(function () {
    throw new InvalidFileUrl();
  });
};

/**
 * Write a stream to specified path
 * @author Peter Nagel
 * @param {Stream} stream stream to write
 * @param {String} filePath path to write file
 * @returns {Promise}
 */
internals.writeStreamToPath = function (stream, filePath) {
  return new Promise(function (resolve, reject) {
    var writeStream = fs.createWriteStream(filePath);

    stream.on('close', function () {
      return resolve();
    });

    /* istanbul ignore next */
    writeStream.on('error', function (err) {
      reject(err);
    });

   /* istanbul ignore next */
    stream.on('error', function (err) {
      reject(err);
    });

    stream.pipe(writeStream);
  });
};

/**
* Combine two files into a single a file
* @param {Buffer/Stream} file1 - first file to combine
* @param {Buffer/Stream} file2 - second file to combine
*/
exports.merge = function (file1, file2) {
  var timestamp      = getUUID().slice(0, 10);
  var file1Path      = '/tmp/merge_' + timestamp + '_in1';
  var file2Path      = '/tmp/merge_' + timestamp + '_in2';
  var mergedFilePath = '/tmp/merge_' + timestamp + '_out';
  return Promise.all([
    file1 instanceof Buffer ? pwrite(file1Path, file1) :
      internals.writeStreamToPath(file1, file1Path),
    file2 instanceof Buffer ? pwrite(file2Path, file2) :
      internals.writeStreamToPath(file2, file2Path)
  ])
  .then(function () {
    var cmd = 'pdftk ' + file1Path + ' ' + file2Path +
      ' cat output ' + mergedFilePath;
    return pexec(cmd);
  })
  .then(function () {
    return fs.createReadStream(mergedFilePath);
  })
  .finally(function () {
    return Promise.all([
      punlink(file1Path),
      punlink(file2Path),
      punlink(mergedFilePath)
    ]);
  });
};

/**
* Takes a PDF buffer, rotates it clockwise and returns as stream
* @param {Buffer/Stream} file - PDF file buffer or stream
* @param {number} degrees - degrees to rotate PDF
*/
exports.rotatePdf = function (file, degrees) {
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    return Promise.reject(new InvalidRotationDegrees());
  }
  var pdfHash  = getUUID() + sha1(file).slice(0, 10);
  var filePath = '/tmp/rotate_' + pdfHash + '_in.pdf';
  var outPath  = '/tmp/rotate_' + pdfHash + '_out.pdf';

  return Promise.resolve(
    file instanceof Buffer ? pwrite(filePath, file) :
      internals.writeStreamToPath(file, filePath)
  )
  .then(function () {
    var cmd = 'convert -rotate ' + degrees + ' -density 300 ' +
    filePath + ' ' + outPath;
    return pexec(cmd);
  })
  .then(function () {
    return fs.createReadStream(outPath);
  })
  .finally(function () {
    return Promise.all([
      punlink(filePath),
      punlink(outPath)
    ]);
  });
};

/**
  * Takes a multipage pdf buffer and returns an array of 1-page pdf buffers
  * (Sorted by page number)
  * @author - Grayson Chao
  * @param {Buffer/Stream} file PDF file buffer or stream
  */
exports.burstPdf = function (file) {
  var filePath = '/tmp/burst_' + getUUID().slice(0, 10);
  return Promise.resolve(
    file instanceof Buffer ? pwrite(filePath, file) :
      internals.writeStreamToPath(file, filePath)
  )
  .then(function () {
    var cmd = 'pdftk ' + filePath + ' burst output ' + filePath + '_page_%03d';
    return pexec(cmd);
  })
  .then(function () {
    return pglob(filePath + '_page_*')
    .then(function (filenames) {
      return _.sortBy(filenames, function (filename) {
        return parseInt(filename.slice(filename.length - 3));
      });
    });
  })
  .bind({})
  .tap(function (filenames) {
    this.outFiles = filenames.concat(filePath);
  })
  .map(function (filename) {
    return {
      page: parseInt(filename.slice(filename.length - 3)),
      file: fs.createReadStream(filename)
    };
  })
  .finally(function () {
    return Promise.resolve(this.outFiles)
    .each(function (filename) {
      return punlink(filename);
    });
  });
};

/**
  * Takes an image and converts it to a PDF.
  * Returns a buffer of a PDF of the Image.
  * @author - Amrit Ayalur
  * @param {Buffer/Stream} image - Image buffer or stream
  * @param {Number} dpi - Desired DPI for the result PDF.
  */
exports.imageToPdf = function (image, dpi) {
  var imageHash = getUUID() + sha1(image).toString().slice(0, 10);
  var filePath = '/tmp/' + imageHash + '.' +
    exports.getMetaData(image).fileType;
  var outPath = '/tmp/' + imageHash + '.pdf';

  return Promise.resolve(
    image instanceof Buffer ? pwrite(filePath, image) :
      internals.writeStreamToPath(image, filePath)
  )
  .then (function () {
    var cmd = 'convert' + ' ' + filePath + ' ' +
     '-quality 100 -units PixelsPerInch -density ' +
      dpi + 'x' + dpi + ' ' + outPath;
    return pexec(cmd);
  })
  .then(function () {
    return fs.createReadStream(outPath);
  })
  .finally(function () {
    return Promise.all([
      punlink(outPath),
      punlink(filePath)
    ]);
  });
};
