// Include gulp
var gulp    = require('gulp');
var plugins = require('gulp-load-plugins')();
var argv    = require('yargs').argv;
var stylish = require('jshint-stylish');

var paths = {
  sourceFiles: 'lib/**/*.js',
  testFiles: 'test/**/*.js',
  gulpFile: 'gulpfile.js'
};

/* jshint camelcase: false */

gulp.task('style', function () {
  return gulp.src([paths.sourceFiles, paths.testFiles, paths.gulpFile])
    .pipe(plugins.jscs());
});

gulp.task('lint', function () {
  return gulp.src([paths.sourceFiles, paths.testFiles, paths.gulpFile])
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter(stylish))
    .pipe(plugins.jshint.reporter('fail'));
});

gulp.task('cover', function () {
  return gulp.src(paths.sourceFiles)
    .pipe(plugins.istanbul());
});

gulp.task('testCI', ['lint', 'style', 'cover'], function () {
  return gulp.src(paths.testFiles)
    .pipe(plugins.mocha({reporter: 'spec', timeout: 15000, grep: argv.grep}))
    .on('error', function (error) {
          plugins.util.log(plugins.util.colors.red(error.message));
          process.exit(1);
        })
    .pipe(plugins.istanbul.writeReports())
    .pipe(plugins.exit());
});

gulp.task('test', ['lint', 'style'], function () {
  return gulp.src(paths.testFiles)
    .pipe(plugins.mocha({reporter: 'spec', timeout: 15000, grep: argv.grep}))
    .on('error', function (error) {
          plugins.util.log(plugins.util.colors.red(error.message));
        })
    .pipe(plugins.exit());
});
