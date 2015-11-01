const gulp = require('gulp'),
      _ = require('lodash'),
      notify = require('gulp-notify'),
      folderToc = require('folder-toc'),
      docco = require('gulp-docco'),
      connect = require('gulp-connect'),
      hb = require('gulp-hb'),
      frontMatter = require('gulp-front-matter'),
      rename = require('gulp-rename'),
      sass = require('gulp-sass'),
      bourbon = require('node-bourbon'),
      browserify = require('browserify'),
      source = require('vinyl-source-stream'),
      buffer = require('vinyl-buffer'),
      sourcemaps = require('gulp-sourcemaps'),
      canopy = require('./lib/canopy-transform'),
      babelify = require('babelify'),
      karma = require('karma'),
      path = require('path'),
      jscs = require('gulp-jscs'),
      config = require('./config');

gulp.task('default', ['server', 'docs'], function() {
  gulp.watch(config.globs.other, ['static']);
  gulp.watch(_.flatten([
    config.globs.templates,
    config.globs.data,
    config.globs.helpers,
    config.globs.partials,
    config.globs.svg_sass
  ]), ['markup']);
  gulp.watch(config.globs.sass, ['styles']);
  gulp.watch(config.globs.js, ['scripts', 'docs']);
});

gulp.task('docs', ['docs:files'], function() {
  folderToc('./docs', {
    filter: '*.html'
  });
});

gulp.task('docs:files', function() {
  return gulp.src(config.globs.js)
    .pipe(docco())
    .pipe(gulp.dest('./docs'));
});

gulp.task('server', ['build'], function() {
  gulp.watch(config.buildPath('**/*'), function(file) {
    return gulp.src(file.path).pipe(connect.reload());
  });

  return connect.server({
    root: config.buildRoot,
    livereload: true
  });
});

gulp.task('build', ['static', 'markup', 'styles', 'scripts']);

gulp.task('static', function() {
  return gulp.src(config.globs.other, { base: './src' })
    .pipe(gulp.dest(config.buildRoot));
});

gulp.task('markup', ['markup:svg_styles'], function() {
  return gulp.src(config.globs.templates)
    .pipe(frontMatter())
    .pipe(hb({
      data: config.globs.data,
      helpers: config.globs.helpers,
      partials: _.flatten([
        config.globs.partials,
        './tmp/build/svg_styles.hbs'
      ]),
      parsePartialName: function(file) {
        return _.last(file.shortPath.split('/'));
      },
      bustCache: true
    }))
    .on('error', notify.onError())
    .pipe(rename(function(path) {
      path.extname = '.html';
    }))
    .pipe(gulp.dest(config.buildRoot));
});

gulp.task('markup:svg_styles', function() {
  return gulp.src('./src/sass/svg.scss')
    .pipe(sass({
      includePaths: bourbon.includePaths
    }))
    .on('error', notify.onError())
    .pipe(rename(function(path) {
      path.dirname = '';
      path.basename = 'svg_styles';
      path.extname = '.hbs';
    }))
    .pipe(gulp.dest('./tmp/build'))
});

gulp.task('styles', function() {
  return gulp.src('./src/sass/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: bourbon.includePaths
    }))
    .on('error', notify.onError())
    .pipe(rename(function(path) {
      path.dirname = '';
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(config.buildPath('css')))
});

gulp.task('scripts', function() {
  return browserify(config.browserify)
    .transform(canopy)
    .transform(babelify)
    .add('./src/js/main.js')
    .bundle()
    .on('error', notify.onError())
    .pipe(source('./src/js/main.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(rename(function(path) {
      path.dirname = '';
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(config.buildPath('js')));
});

gulp.task('verify', ['karma:single', 'lint']);

gulp.task('verify:watch', ['karma', 'lint:watch']);

gulp.task('karma', function(done) {
  new karma.Server({
    configFile: path.join(__dirname, 'karma.conf.js')
  }, done).start();
});

gulp.task('karma:single', function(done) {
  new karma.Server({
    configFile: path.join(__dirname, 'karma.conf.js'),
    singleRun: true
  }, done).start();
});

gulp.task('lint', function() {
  return gulp.src(config.globs.lint)
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(jscs.reporter('fail'))
    .on('error', notify.onError())
});

gulp.task('lint:watch', function() {
  gulp.watch(config.globs.lint, ['lint']);
});

gulp.task('lint:fix', config.lintRoots.map(function(root) {
  return 'lint:fix:' + root;
}), function() {
  return gulp.src('./*.js')
    .pipe(jscs({fix: true}))
    .pipe(gulp.dest('.'));
});

config.lintRoots.forEach(function(root) {
  gulp.task('lint:fix:' + root, function() {
    return gulp.src('./' + root + '/**/*.js')
      .pipe(jscs({fix: true}))
      .pipe(gulp.dest('./' + root));
  });
});
