var chai    = require('chai');
var expect  = chai.expect;
var Massage = require('../massage');
var fs      = require('fs');
var Bluebird = require('bluebird');

chai
.use(require('chai-as-promised'))
.use(require('chai-things'));

describe('file library', function () {
  describe('getMetaData', function () {
    it('should be able to handle a buffer', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.readFileSync(filePath);
      return expect(Massage.getMetaData(testFile)).to.eventually.eql(
        {fileType: 'PDF', width: 432, length: 288, numPages: 1}
      );
    });

    it('should be able to handle a stream', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.createReadStream(filePath);
      return expect(Massage.getMetaData(testFile)).to.eventually.eql(
        {fileType: 'PDF', width: 432, length: 288, numPages: 1}
      );
    });

    it('should fail with an invalid buffer type', function () {
      var testFile = new Buffer(10);
      return expect(Massage.getMetaData(testFile)).to.be.rejected;
    });

    it('should fail with an invalid file type', function () {
      var filePath = __dirname + '/assets/8.5x11.docx';
      var testFile = fs.readFileSync(filePath);
      return expect(Massage.getMetaData(testFile)).to.be.rejected;
    });
  });

  describe('validateUrl', function () {
    it('should pass with valid url and protocol', function () {
      return expect(Massage.validateUrl('https://www.lob.com'))
        .to.be.fulfilled;
    });

    it('should fail with non-url', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      fs.readFile(filePath, function (err, buffer) {
        return expect(Massage.validateUrl(buffer))
          .to.be.rejected;
      });
    });

    it('should fail with valid url and no protocol', function () {
      return expect(Massage.validateUrl('www.lob.com'))
        .to.be.rejected;
    });
  });

  describe('getBuffer', function () {
    it('should return a buffer unmodified', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.readFileSync(filePath);

      return Massage.getBuffer(testFile)
      .then(function (file) {
        return expect(file instanceof Buffer).to.eql(true);
      });
    });

    it('should not override url', function () {
      return Massage.getBuffer('https://www.lob.com/test.pdf')
      .then(function (file) {
        return expect(file instanceof Buffer).to.eql(true);
      });
    });

    it('should download file and return buffer', function () {
      return Massage.getBuffer('https://www.lob.com/test.pdf')
      .then(function (file) {
        return expect(file instanceof Buffer).to.eql(true);
      });
    });

    it('should throw an error for an invlaid url', function () {
      return expect(Massage.getBuffer('test.pdf')).to.be.rejected;
    });

    it('should throw an error when the url is wrong', function () {
      return expect(Massage.getBuffer('https://www.loasdfas.com'))
        .to.be.rejected;
    });
  });

  describe('getStream', function () {
    it('should not override url', function () {
      return Massage.getStream('https://www.lob.com/test.pdf')
      .then(function (file) {
        return expect(file.pipe instanceof Function).to.eql(true);
      });
    });

    it('should throw an error for an invlaid url', function () {
      return expect(Massage.getStream('test.pdf')).to.be.rejected;
    });

    it('should throw an error when the url is wrong', function () {
      return expect(Massage.getStream('https://www.asdflkj.com'))
      .to.be.rejected;
    });

    it('should throw an error when not authorized', function () {
      return expect(Massage.getStream('https://api.lob.com/'))
        .to.be.rejected;
    });
  });

  describe('merge', function () {
    it('should combine two files from buffers', function () {
      var file1 = fs.readFileSync(__dirname + '/assets/4x6.pdf');
      var file2 = fs.readFileSync(__dirname + '/assets/4x6.pdf');

      return Massage.merge(file1, file2)
      .then (function (mergedFile) {
        this.mergedFile = mergedFile;
        return Bluebird.all([
          Massage.getMetaData(file1),
          Massage.getMetaData(file2),
          Massage.getMetaData(fs.createReadStream(mergedFile))
        ]);
      })
      .spread(function (file1, file2, mergedFile) {
        return expect(file1.numPages + file2.numPages)
          .to.eql(mergedFile.numPages);
      })
      .finally(function () {
        fs.unlinkSync(this.mergedFile);
      });
    });

    it('should combine two files from streams', function () {
      var file1 = fs.createReadStream(__dirname + '/assets/4x6.pdf');
      var file2 = fs.createReadStream(__dirname + '/assets/4x6.pdf');

      return Massage.merge(file1, file2)
      .then (function (mergedFile) {
        this.mergedFile = mergedFile;
        return Bluebird.all([
          Massage.getMetaData(
            fs.createReadStream(__dirname + '/assets/4x6.pdf')),
          Massage.getMetaData(
            fs.createReadStream(__dirname + '/assets/4x6.pdf')),
          Massage.getMetaData(fs.createReadStream(mergedFile))
        ]);
      })
      .spread(function (file1, file2, mergedFile) {
        return expect(file1.numPages + file2.numPages)
          .to.eql(mergedFile.numPages);
      })
      .finally(function () {
        fs.unlinkSync(this.mergedFile);
      });
    });

  });

  describe('rotatePdf', function () {
    it('should rotate a PDF', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.readFileSync(filePath);
      return Massage.rotatePdf(testFile, 90)
      .then(function (data) {
        this.filePath = data;
        return expect(Massage.getMetaData(fs.createReadStream(data)))
          .to.eventually.eql(
          {fileType: 'PDF', width: 288, length: 432, numPages: 1}
        );
      })
      .finally(function () {
        fs.unlinkSync(this.filePath);
      });
    });

    it('should rotate a PDF from stream', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.createReadStream(filePath);
      return Massage.rotatePdf(testFile, 90)
      .then(function (data) {
        this.filePath = data;
        return expect(Massage.getMetaData(fs.createReadStream(data)))
          .to.eventually.eql(
          {fileType: 'PDF', width: 288, length: 432, numPages: 1}
        );
      })
      .finally(function () {
        fs.unlinkSync(this.filePath);
      });
    });

    it('should error when an invalid buffer is given', function () {
      return expect(Massage.rotatePdf(new Buffer(10), 90)).to.be.rejected;
    });

    it('should error when an invalid degrees is given', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = fs.readFileSync(filePath);
      return expect(Massage.rotatePdf(testFile, 33)).to.be.rejected;
    });
  });

  describe('burstPdf', function () {
    it('should burst a pdf into pages', function () {
      var filePath = __dirname + '/assets/4x6_twice.pdf';
      var testFile = fs.readFileSync(filePath);
      return Massage.burstPdf(testFile)
      .then(function (files) {
        return expect(files).to.have.length(2);
      });
    });

    it('should burst a stream pdf into pages', function () {
      var filePath = __dirname + '/assets/4x6_twice.pdf';
      var testFile = fs.createReadStream(filePath);
      return Massage.burstPdf(testFile)
      .then(function (files) {
        return expect(files).to.have.length(2);
      });
    });
  });

  describe('imageToPdf', function () {
    it('should convert an image to a pdf', function () {
      var filePath = __dirname + '/assets/1200x1800.png';
      var testFile = fs.readFileSync(filePath);
      return Massage.imageToPdf(testFile, '300')
      .then(function (pdf) {
        return expect(Massage.getMetaData(pdf)).to.eventually.eql(
          {fileType: 'PDF', width: 288, length: 432, numPages: 1}
       );
      });
    });

    it('should convert a stream image to a pdf', function () {
      var filePath = __dirname + '/assets/1200x1800.png';
      var testFile = fs.createReadStream(filePath);
      return Massage.imageToPdf(testFile, '300')
      .then(function (pdf) {
        return expect(Massage.getMetaData(pdf)).to.eventually.eql(
          {fileType: 'PDF', width: 288, length: 432, numPages: 1}
       );
      });
    });
  });

  describe('writeStreamToFile', function () {
    it('should return a file path from read stream', function () {
      var readStream = fs.createReadStream(__dirname + '/assets/4x6.pdf');
      return expect(Massage.writeStreamToFile(readStream))
        .to.eventually.be.a('string');
    });
  });
});
