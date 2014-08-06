var chai    = require('chai');
var expect  = chai.expect;
var Massage = require('../massage');
var Fs      = require('fs');
var async   = require('async');
var sizeOf  = require('image-size');

/* jshint expr: true */
chai
.use(require('chai-as-promised'))
.use(require('chai-things'));

describe('file library', function () {
  describe('writeTemp', function () {
    it('should have correct defaults', function (done) {
      return Massage.writeTemp(new Buffer(0))(function (err, file) {
        expect(file).to.have.property('fd');
        expect(file).to.have.property('path');
        done();
      });
    });
  });

  describe('getMetaData', function () {
    it('should be able to handle a buffer', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      var testFile = Fs.readFileSync(filePath);
      return Massage.getMetaData(testFile, function (err, data) {
        expect(data).eql({fileType: 'PDF', width: 6, length: 4, numPages: 1});
        done();
      });
    });

    it('should fail with an invalid buffer type', function (done) {
      var testFile = new Buffer(10);
      return Massage.getMetaData(testFile, function (err) {
        expect(err).to.exist;
        done();
      });
    });

    it('should fail with an invalid file type', function (done) {
      var filePath = __dirname + '/assets/8.5x11.docx';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.getMetaData(testFile, function (err) {
          expect(err).to.exist;
          done();
        });
      });
    });
  });

  describe('validateUrl', function () {
    it('should pass with valid url and protocol', function (done) {
      return Massage.validateUrl('https://www.lob.com', function (err, res) {
        expect(res).to.eql('https://www.lob.com');
        done();
      });
    });

    it('should pass with valid url and no protocol', function (done) {
      return Massage.validateUrl('www.lob.com', function (err, res) {
        expect(res).to.eql('www.lob.com');
        done();
      });
    });

    it('should fail with non-url', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      return Fs.readFile(filePath, function (err, buffer) {
        Massage.validateUrl(buffer, function (err) {
          expect(err).to.exist;
          done();
        });
      });
    });

    it('should pass with valid url and invalid protocol', function (done) {
      return Massage.validateUrl('invalid://www.lob.com', function (err) {
        expect(err).to.exist;
        done();
      });
    });
  });

  describe('getBuffer', function () {
    it('should return a buffer unmodified', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.getBuffer(testFile, function (err, file) {
          expect(file instanceof Buffer).to.eql(true);
          done();
        });
      });
    });

    it('should download file and return buffer', function (done) {
      Massage.getBuffer('https://www.lob.com/test.pdf', function (err, file) {
        expect(file instanceof Buffer).to.eql(true);
        done();
      });
    });

    it('should throw an error for an invlaid url', function (done) {
      return Massage.getBuffer('test.pdf', function (err) {
        expect(err).to.exist;
        done();
      });
    });

    it('should throw an error when the url is wrong', function (done) {
      return Massage.getBuffer('http://loasdfs.com', function (err) {
        expect(err).to.exist;
        done();
      });
    });
  });

  describe('merge', function () {
    it('should combine two files', function (done) {
      async.parallel({
        file1: function (done) {
          Fs.readFile(__dirname + '/assets/4x6.pdf', done);
        },
        file2: function (done) {
          Fs.readFile(__dirname + '/assets/4x6.pdf', done);
        }
      }, function (err, res) {
        Massage.merge(res.file1, res.file2, function (err, merged) {
          async.parallel({
            file1: function (done) {
              Massage.getMetaData(res.file1, done);
            },
            file2: function (done) {
              Massage.getMetaData(res.file2, done);
            },
            merged: function (done) {
              Massage.getMetaData(merged, done);
            }
          }, function (err, res) {
            expect(res.file1.numPages + res.file2.numPages)
              .to.eql(res.merged.numPages);
            done();
          });
        });
      });
    });

    it('should error when pdftk fails', function (done) {
      return Massage.merge(new Buffer(10), new Buffer(20), function (err) {
        expect(err).to.exist;
        done();
      });
    });
  });

  describe('imageToPdf', function () {
    it('should convert an image to a pdf', function (done) {
      var filePath = __dirname + '/assets/1200x1800.png';
      return Fs.readFile(filePath, function (err, testFile) {
        return Massage.imageToPdf(testFile, '300', function (err, pdf) {
          return Massage.getMetaData(pdf, function (err, data) {
            expect(data).to.eql(
              {fileType: 'PDF', width: 4, length: 6, numPages: 1}
            );
            done();
            return;
          });
        });
      });
    });

    it('should fail with an invalid file type', function (done) {
      var filePath = __dirname + '/assets/8.5x11.docx';
      return Fs.readFile(filePath, function (err, testFile) {
        return Massage.imageToPdf(testFile, '300', function (err) {
          expect(err).to.exist;
          done();
          return;
        });
      });
    });

    it('should error with bad input', function (done) {
      var filePath = __dirname + '/assets/1200x1800.png';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.imageToPdf(testFile, 'lob', function (err) {
          expect(err).to.exist;
          done();
        });
      });
    });
  });

  describe('rotatePdf', function () {
    it('should rotate a PDF and return buffer', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.rotatePdf(testFile, 90, function (err, buf) {
          Massage.getMetaData(buf, function (err, data) {
            expect(data)
            .to.eql({fileType: 'PDF', width: 4, length: 6, numPages: 1});
            done();
          });
        });
      });
    });

    it('should error when an invalid buffer is given', function (done) {
      return Massage.rotatePdf(new Buffer(10), 90, function (err) {
        expect(err).to.exist;
        done();
      });
    });

    it('should error when an invalid degrees is given', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.rotatePdf(testFile, 33, function (err) {
          expect(err).to.exist;
          done();
        });
      });
    });
  });

  describe('generateThumbnail', function () {
    it('should generate a png with valid input', function (done) {
      var filePath = __dirname + '/assets/4x6.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.generateThumbnail(testFile, '300', function (err, thumb) {
          expect(sizeOf(thumb).height).to.eql(200);
          expect(sizeOf(thumb).width).to.eql(300);
          done();
        });
      });
    });

    it('should error on invalid input', function (done) {
      var filePath = __dirname + '/assets/4x7-WRONGNAME!.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        return Massage.generateThumbnail(testFile, '300', function (err) {
          expect(err).to.exist;
          done();
        });
      });
    });
  });

  describe('burstPdf', function () {
    it('should burst a pdf into pages', function (done) {
      var filePath = __dirname + '/assets/4x6_twice.pdf';
      return Fs.readFile(filePath, function (err, testFile) {
        Massage.burstPdf(testFile, function (err, bufs) {
          expect(bufs).to.have.length(2);
          done();
        });
      });
    });

    it('should error with bad input', function (done) {
      Massage.burstPdf('asdfasdf', function (err, bufs) {
        console.log(bufs);
        expect(err).to.exist;
        done();
      });
    });
  });
});
/* jshint expr: false */
