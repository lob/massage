# Massage

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url]  [![Build Status](https://travis-ci.org/lob/massage.svg?branch=master)](https://travis-ci.org/lob/massage) [![Dependency Status](https://gemnasium.com/lob/massage.svg)](https://gemnasium.com/lob/massage) [![Coverage Status](https://img.shields.io/coveralls/lob/massage.svg)](https://coveralls.io/r/lob/massage?branch=master)

[downloads-image]: http://img.shields.io/npm/dm/massage.svg
[npm-url]: https://npmjs.org/package/massage
[npm-image]: https://badge.fury.io/js/massage.svg
[travis-url]: https://travis-ci.org/lob/massage
[travis-image]: https://travis-ci.org/lob/massage.svg?branch=master
[depstat-url]: https://david-dm.org/Lob/massage
[depstat-image]: https://david-dm.org/Lob/massage.svg

## Dependencies
###ImageMagick and GhostScript
```bash
  osx> brew install imagemagick ghostscript
```

```bash
  ubuntu> sudo apt-get install imagemagick ghostscript pdftk
```

###PDFtk
Go to http://www.pdflabs.com/tools/pdftk-server/ for official installation of PDFtk

## Usage

#####`getMetaData( [Buffer image] )` -> `Object`

Returns a promise of an object with metadata about the buffer, as told by ImageMagick.
```
{
  fileType: 'pdf|png|jpg|etc...' [String]
  width: document width in inches [Number]
  length: document length in inches [Number]
  numPages: number of images in the image sequence (number of pages in the PDF) [Number]
}
```
If ImageMagick's `identify` tool can't handle the passed buffer, then the promise
is rejected.

#####`validateUrl( [String url] )` -> `String`

Returns a promise that is rejected if the given URL is not valid. Otherwise it
resolves to the URL.

#####`getBuffer( [String url|Buffer buffer|Object options] )` -> `Buffer`

Takes a buffer, a URL, or an options object and return a Promise that resolves
to a buffer. If you pass an options object it is passed into the `request.js`
constructor, but if you don't supply a `method`, `timeout`, or `encoding`, they
default to `GET`, `10000`, and `null` respectively. The promise always resolves
to a buffer which is either the passed buffer or the result of `request.js`
GET'ing the URL.

#####`getStream( [String url] )` -> `Stream`

Takes a URL determines if it is valid and if so returns a readable stream.

If the URL is invalid or `request.js` fails, the promise is rejected.

#####`merge( [Buffer/Stream pdf], [Buffer/Stream pdf] )` -> `Stream pdf`

Merge two PDFs using `pdftk` and returns a promise which resolves to the
resulting rotated pdf (as a stream.)

Could be rejected if `pdftk` chokes on the buffer, or you don't have enough
disk space to write the results.

#####`rotatePdf( [Buffer/Stream pdf], [Number degrees] )` -> `Stream pdf`

Returns a promise which resolves to the pdf, rotated by the given number of
degrees. Backed by ImageMagick `convert`.

Could be rejected if `convert` chokes on the buffer, or you don't have enough
disk space to write the results.

#####`burstPdf( [Buffer/Stream pdf] )` -> `[Stream]`

Takes a multi-page PDF buffer and returns a promise of an array of 1-page pdf
streams. Backed by `pdftk`'s `burst` utility. Always resolves to an array,
even if there's just one page in the PDF.

Could be rejected if `pdftk` chokes on the buffer, or you don't have enough
disk space to write the results.

#####`imageToPdf( [Buffer/Stream image], [Number dpi] )` -> `Stream`

Takes a buffer containing an image file and converts it to pdf format
at the specified DPI. Returns a promise that resolves to a stream containing the
pdf file. Backed by ImageMagick `convert`.

Could be rejected if `convert` chokes on the buffer, or you don't have enough
disk space to write the results.
