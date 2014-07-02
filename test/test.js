var chai        = require('chai');
var expect      = chai.expect;
var FileLibrary = require('../massage');
var Fs          = require('fs');

chai
.use(require('chai-as-promised'))
.use(require('chai-things'));

describe('file library', function () {
  describe('getMetaData', function () {
    it('should be able to handle a buffer', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = Fs.readFileSync(filePath);
      return expect(FileLibrary.getMetaData(testFile)).to.eventually.eql(
        {fileType: 'PDF', width: 6, length: 4, numPages: 1}
      );
    });

    it('should fail with an invalid buffer type', function () {
      var testFile = new Buffer(10);
      return expect(FileLibrary.getMetaData(testFile)).to.be.rejected;
    });

    it('should fail with an invalid file type', function () {
      var filePath = __dirname + '/assets/8.5x11.docx';
      var testFile = Fs.readFileSync(filePath);
      return expect(FileLibrary.getMetaData(testFile)).to.be.rejected;
    });
  });

  describe('getBuffer', function () {
    it('should return a buffer unmodified', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = Fs.readFileSync(filePath);

      return FileLibrary.getBuffer(testFile)
      .then(function (file) {
        return expect(file instanceof Buffer).to.eql(true);
      });
    });

    it('should download file and return buffer', function () {
      return FileLibrary.getBuffer('https://www.lob.com/test.pdf')
      .then(function (file) {
        return expect(file instanceof Buffer).to.eql(true);
      });
    });

    it('should throw an error for an invlaid url', function () {
      return expect(FileLibrary.getBuffer('test.pdf')).to.be.rejected;
    });

    it('should throw an error when the url is wrong', function () {
      return expect(FileLibrary.getBuffer('https://www.loasdfas.com'))
        .to.be.rejected;
    });
  });

  describe('rotatePdf', function () {
    it('should rotate a PDF and return buffer', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = Fs.readFileSync(filePath);
      return FileLibrary.rotatePdf(testFile, 90)
      .then(function (data) {
        return expect(FileLibrary.getMetaData(data)).to.eventually.eql(
          {fileType: 'PDF', width: 4, length: 6, numPages: 1}
        );
      });
    });

    it('should error when an invalid buffer is given', function () {
      return expect(FileLibrary.rotatePdf(new Buffer(10), 90)).to.be.rejected;
    });

    it('should error when an invalid degrees is given', function () {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = Fs.readFileSync(filePath);
      return expect(FileLibrary.rotatePdf(testFile, 33)).to.be.rejected;
    });
  });
});
