var m = require('./massage');

(function () {
  return m.getBuffer('http://assets.lob-dev.com/3x4x6.pdf')
  .then(function (pdf) {
    return m.burstPdf(pdf)
  })
  .map(function (page) {
    return m.generateThumbnail(page.file, '20%');
  })
})();
