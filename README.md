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
  brew install imagemagick ghostscript
```

###PDFtk
Go to http://www.pdflabs.com/tools/pdftk-server/ for official installation of PDFtk

## Usage

#####`getMetaData( [Buffer image] )` -> `Object`

Returns an object with metadata about the buffer, as told by ImageMagick.
```
{
  fileType: 'pdf|png|jpg|etc...' [String]
  width: document width in inches [Number]
  length: document length in inches [Number]
  numPages: number of images in the image sequence (number of pages in the PDF) [Number]
}
```

#####`validateUrl( [String url] )` -> `String`

Throws an error if the given URL is not valid.

#####`getBuffer( [String url|Buffer buffer] )` -> `Buffer`

Takes either a buffer or URL and returns a buffer.

#####`merge( [Buffer pdf], [Buffer pdf] )` -> `Buffer pdf`

Merge two PDFs using pdftk.

#####`rotatePdf( [Buffer pdf], [Number degrees] )` -> `Buffer pdf`

Return the pdf, rotated by the given number of degrees.

#####`burstPdf( [Buffer pdf] )` -> `[pdf Buffer, pdf Buffer, ...]`

Takes a multi-page PDF buffer and returns an array of 1-page pdf buffers.
Always returns an array, even if there's just one page in the PDF.

#####`generateThumbnail( [Buffer pdf], [Number size] )` -> `Buffer pdf`

Return a copy of the image resized to SIZE% of its original size.

#####`imageToPdf ( [Buffer image], [Number dpi] )` -> `Buffer pdf`

Return the result of converting the input image to a PDF at specified DPI.
