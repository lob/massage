var Promise     = require('bluebird');
var request     = require('request');
var spawn       = require('child_process').spawn;
var exec        = require('child_process').exec;
var Streamifier = require('streamifier');
var Url         = require('url');
var Fs          = require('fs');
var sha1        = require('sha1');
var glob        = require('glob');

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

/**
* Takes a buffer and returns the relevant metadata
* @param {Buffer} buffer - readable file stream
*/
exports.getMetaData = function (buffer) {

  return new Promise(function (resolve, reject) {
    var fileStream = Streamifier.createReadStream(buffer);
    var identify = spawn('identify',['-format','%m,%[fx:w/72],%[fx:h/72],%n,',
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
    fileStream.pipe(identify.stdin);
  });
};

/**
* Takes a string/buffer and checks if it is a valid URL
* @param {String} url - url to validate
*/
exports.validateUrl = Promise.method(function (url) {
  if (
    !url ||
    (url instanceof Buffer) ||
    Url.parse(url).protocol === 'invalid:'
  ) {
    throw new InvalidFileUrl();
  } else {
    return url;
  }
});

/**
* Takes either a buffer or a URL and returns a buffer
* @param {File} file - URL or buffer
*/
exports.getBuffer = Promise.method(function (file) {
  if (file instanceof Buffer) {
    return file;
  }

  if (!Url.parse(file).protocol) {
    throw new InvalidFileUrl();
  }

  var options = {
    method: 'GET',
    url: file,
    timeout: 10000,
    encoding: null
  };

  var preq = Promise.promisify(request);

  return preq(options)
  .then(function (res) {
    return res[0].body;
  })
  .catch(function () {
    throw new InvalidFileUrl();
  });
});

/**
* Combine two files into a single a file
* @param {File} file1 - first file to combine
* @param {File} file3 - second file to combine
*/
exports.merge = function (file1, file2) {
  var pwrite = Promise.promisify(Fs.writeFile);
  var pexec = Promise.promisify(exec);
  var punlink = Promise.promisify(Fs.unlink);
  var file1Path = '/tmp/1' + sha1(Date.now().toString()).slice(0, 10);
  var file2Path = '/tmp/2' + sha1(Date.now().toString()).slice(0, 10);
  var mergedFilePath = '/tmp/3' + sha1(Date.now().toString()).slice(0, 10);
  return Promise.all([
    pwrite(file1Path, file1),
    pwrite(file2Path, file2)
  ])
  .then(function () {
    var cmd = 'pdftk ' + file1Path + ' ' + file2Path +
      ' cat output ' + mergedFilePath;
    return pexec(cmd);
  })
  .bind({})
  .then(function () {
    this.mergedFile = Fs.readFileSync(mergedFilePath);
    return Promise.all([
      punlink(file1Path),
      punlink(file2Path),
      punlink(mergedFilePath)
    ]);
  })
  .then(function () {
    return this.mergedFile;
  });
};

/**
* Takes a PDF buffer, rotates it clockwise and returns as buffer
* @param {Buffer} buffer - PDF file buffer
* @param {number} degrees - degrees to rotate PDF
*/
exports.rotatePdf = function (buffer, degrees) {
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    return Promise.reject(new InvalidRotationDegrees());
  }
  var pwrite = Promise.promisify(Fs.writeFile);
  var pexec = Promise.promisify(exec);
  var punlink = Promise.promisify(Fs.unlink);
  var filePath = '/tmp/' + sha1(Date.now().toString() +
      buffer.toString().slice(0,100)).slice(0,10) + '.pdf';
  var outPath = '/tmp/' + sha1(Date.now().toString() +
      buffer.toString().slice(100,200)).slice(0,10) + '.pdf';

  return pwrite(filePath, buffer)
  .then(function () {
    var cmd = 'convert -rotate ' + degrees + ' -density 300 ' +
    filePath + ' ' + outPath;
    return pexec(cmd);
  })
  .bind({})
  .then(function () {
    this.outFile = Fs.readFileSync(outPath);

    return Promise.all([
      punlink(filePath),
      punlink(outPath)
    ]);
  })
  .then(function () {
    return this.outFile;
  });
};

/**
  * Takes a multipage pdf buffer and returns an array of 1-page pdf buffers
  * @author - Grayson Chao
  * @param {Buffer} pdf PDF file buffer
  */
exports.burstPdf = function (pdf) {
  var pwrite = Promise.promisify(Fs.writeFile);
  var pexec = Promise.promisify(exec);
  var punlink = Promise.promisify(Fs.unlink);
  var pread = Promise.promisify(Fs.readFile);
  var pglob = Promise.promisify(glob);
  var hash = function () {
    return sha1(Date.now().toString());
  };
  var filePath = '/tmp/split_' + hash().slice(0, 10);
  return pwrite(filePath, pdf)
  .then(function () {
    var cmd = 'pdftk ' + filePath + ' burst output ' + filePath + '_page_%03d';
    return pexec(cmd);
  })
  .then(function () {
    return pglob(filePath + '_page_*');
  })
  .bind({})
  .tap(function (filenames) {
    this.outFiles = filenames;
  })
  .map(function (filename) {
    return pread(filename);
  })
  .then(function (files) {
    return files; // actual return value when resolved
  })
  .finally(function () {
    return Promise.resolve(this.outFiles)
    .each(function (file) {
      return punlink(file);
    });
  });
};

/**
  * Takes a pdf and resizes it to thumbnail size.
  * Returns a buffer of a PNG of the thumbnail.
  * @author - Grayson Chao
  * @param {Buffer} pdf PDF file buffer
  */
exports.generateThumbnail = function (pdf) {
  var pwrite  = Promise.promisify(Fs.writeFile);
  var pexec   = Promise.promisify(exec);
  var punlink = Promise.promisify(Fs.unlink);
  var pread   = Promise.promisify(Fs.readFile);

  var filePath = '/tmp/' + sha1(Date.now().toString() +
      pdf.toString().slice(0,100)).slice(0,10) + '.pdf';
  var outPath = '/tmp/' + sha1(Date.now().toString() +
      pdf.toString().slice(100,200)).slice(0,10) + '.png';

  return pwrite(filePath, pdf)
  .then(function () {
    var cmd = 'convert -density 300x300 -resize 200x300 ' +
      filePath + ' ' + outPath;
    return pexec(cmd);
  })
  .bind({})
  .then(function () {
    return pread(outPath);
  })
};
