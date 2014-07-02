var gulp    = require('gulp');
var plugins = require('gulp-load-plugins')();
var argv    = require('yargs').argv;
var stylish = require('jshint-stylish');

var paths = {
  sourceFiles: 'massage.js',
  testFiles: 'test/test.js',
  gulpFile: 'gulpfile.js'
};

var envVars = {
  NODE_ENV: 'development',
  COVERAGE_DIR: '.'
};
/* jshint camelcase: false */

gulp.task('style', function () {
  gulp.src([paths.sourceFiles, paths.testFiles, paths.gulpFile])
    .pipe(plugins.jscs());
});

gulp.task('lint', function () {
  gulp.src([paths.sourceFiles, paths.testFiles, paths.gulpFile])
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter(stylish))
    .pipe(plugins.jshint.reporter('fail'));
});

gulp.task('test', ['lint', 'style'], function () {
  gulp.src(paths.testFiles)
    .pipe(plugins.mocha({reporter: 'spec', timeout: 15000, grep: argv.grep}))
    .on('error', function (error) {
        plugins.util.log(plugins.util.colors.red(error.message));
    })
    .pipe(plugins.exit());
});

gulp.task('cover', function () {

  if (process.env.NODE_ENV !== 'test') {
    Object.keys(envVars).forEach(function (key) {
      process.env[key] = envVars[key];
    });
  }

  return gulp.src(paths.sourceFiles)
    .pipe(plugins.istanbul());
});

gulp.task('testCI', ['lint', 'style', 'cover'], function () {
  // require('./test/setup');
  if (process.env.NODE_ENV !== 'test') {
    gulp.src(process.env.COVERAGE_DIR + '/coverage')
      .pipe(plugins.clean());
    Object.keys(envVars).forEach(function (key) {
      process.env[key] = envVars[key];
    });
  }

  var options = {
    dir: process.env.COVERAGE_DIR + '/coverage',
    reporters: ['lcov', 'json', 'text', 'text-summary'],
    reportOpts: {dir: process.env.COVERAGE_DIR + '/coverage'}
  };

  return gulp.src(paths.testFiles)
    .pipe(plugins.mocha({reporter: 'spec', timeout: 15000, grep: argv.grep}))
    .on('error', function (error) {
      plugins.util.log(plugins.util.colors.red(error.message));
      process.exit(1);
    })
    .pipe(plugins.istanbul.writeReports(options))
    .pipe(plugins.exit());
});
