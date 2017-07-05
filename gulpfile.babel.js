import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import browserSync from 'browser-sync';
import del from 'del';
import sassModuleImporter from 'sass-module-importer';
import browserify from 'browserify';
import babelify from 'babelify';
import rollupify from 'rollupify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

const packageJSON = require('./package.json');
const dependenciesObject = (packageJSON && packageJSON.dependencies) || {};
const vendorDeps = Object.keys(dependenciesObject).filter(name => !/\.s?css|\.sass/.test(name));

function lint(files) {
  return () => {
    return gulp.src(files)
      .pipe($.plumber({
        errorHandler(err) {
          console.log(err); // eslint-disable-line no-console
          this.emit('end');
        }
      }))
      .pipe($.eslint())
      .pipe($.eslint.format())
      .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
  };
}

gulp.task('styles', ['styles:lint'], () => {
  return gulp.src('./src/styles/**/*.scss')
    .pipe($.plumber({
      errorHandler(err) {
        console.log(err); // eslint-disable-line no-console
        this.emit('end');
      }
    }))
    .pipe($.sass({
      importer: sassModuleImporter()
    }))
    .pipe($.sourcemaps.init())
    .pipe($.autoprefixer({
      browsers: ['last 1 version']
    }))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('./dist/css'))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('styles:lint', () => {
  return gulp.src('./src/styles/**/*.scss')
    .pipe($.stylelint({
      reporters: [{
        formatter: 'string',
        console: true
      }]
    }));
});

gulp.task('lint', lint('./src/scripts/**/*.js'));
gulp.task('lint:test', lint('test/spec/**/*.js'));

gulp.task('scripts', ['scripts:vendor'], () => {
  return browserify({
    entries: './src/scripts/main.js',
    debug: true,
  })
    .external(vendorDeps)
    .transform(babelify)
    .transform(rollupify)
    .bundle()
    .on('error', $.notify.onError({
      title: 'Failed running browserify',
      message: 'Error: <%= error.message %>'
    }))
    .pipe(source('main.js'))
    .pipe(buffer())
    .pipe($.sourcemaps.init({
      loadMaps: true
    }))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('./dist/js'))
    .pipe(reload({
      stream: true,
      once: true
    }));
});

gulp.task('scripts:vendor', () => (
  browserify()
    .require(vendorDeps)
    .transform(rollupify)
    .bundle()
    .on('error', $.notify.onError({
      title: 'Failed running browserify',
      message: 'Error: <%= error.message %>'
    }))
    .pipe(source('vendor.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist/js'))
));

gulp.task('hbs', () => {
  return gulp.src('./src/hbs/*.hbs')
    .pipe($.plumber({
      errorHandler(err) {
        console.log(err); // eslint-disable-line no-console
        this.emit('end');
      }
    }))
    .pipe($.frontMatter({
      property: 'data',
      remove: true
    }))
    .pipe(
      $.hb({
        bustCache: true,
        helpers: [
          './src/hbs/helpers/repeat.js',
          './node_modules/handlebars-helpers/lib/fs.js',
          './node_modules/handlebars-helpers/lib/comparison.js',
          './node_modules/handlebars-helpers/lib/collection.js',
          './node_modules/handlebars-helpers/lib/string.js',
          './node_modules/handlebars-helpers/lib/math.js',
          './node_modules/handlebars-layouts'
        ]
      })
      .partials('./src/hbs/layouts/*.hbs')
      .partials('./src/hbs/partials/**/*.hbs')
    )
    .pipe($.rename({
      extname: '.html',
    }))
    .pipe(gulp.dest('./dist'))
    .pipe(reload({
      stream: true,
      once: true
    }));
});

gulp.task('html', ['hbs', 'styles', 'scripts'], () => {
  return gulp.src('./dist/*.html')
    .pipe($.useref())
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cleanCss({
      compatibility: '*'
    })))
    .pipe($.if('*.html', $.htmlmin({
      collapseWhitespace: true,
      conditionals: true
    })))
    .pipe(gulp.dest('./dist'));
});

gulp.task('images', () => {
  return gulp.src('./src/images/**/*.{png,jpg,jpeg,gif,svg}')
    .pipe($.plumber())
    .pipe($.if($.if.isFile, $.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{
        cleanupIDs: false,
        removeUselessDefs: true,
        convertStyleToAttrs: true
      }]
    }))
    .on('error', (err) => {
      console.log(err); // eslint-disable-line no-console
      this.end();
    })))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('fonts', () => {
  return gulp.src(['./src/fonts/*.{eot,svg,ttf,woff,woff2}'])
    .pipe(gulp.dest('./dist/fonts'));
});

gulp.task('extras', () => {
  return gulp.src([
    './src/*.*',
    '!./src/.DS_Store',
    '!src/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', () => {
  return del.sync('./dist');
});

gulp.task('serve', ['clean', 'hbs', 'styles', 'lint', 'scripts'], () => {
  browserSync({
    notify: false,
    port: 9000,
    server: {
      baseDir: './dist',
      routes: {
        '/images': 'src/images',
        '/fonts': 'src/fonts'
      },
      directory: true
    }
  });

  $.watch([
    './src/hbs/partials/**/*.hbs',
    './src/hbs/layouts/*.hbs',
    './src/hbs/*.html'
  ], () => {
    gulp.start('hbs');
  });

  $.watch('./src/scripts/**/*.js', () => {
    gulp.start('scripts');
    gulp.start('lint');
  });

  $.watch('./src/styles/**/*.scss', () => {
    gulp.start('styles');
  });

  gulp.watch('./src/images/**/**.{png,jpg,jpeg,gif,svg}').on('change', reload);
});

gulp.task('test', () => {
  gulp.src('./test/**/*.js', { read: false })
    .pipe($.mocha());
});

gulp.task('test:watch', ['lint:test', 'test'], () => {
  $.watch('./test/spec/**/*.js', () => {
    gulp.start('lint:test');
    gulp.start('test');
  });
});

gulp.task('build', ['clean', 'lint', 'html', 'fonts', 'extras', 'images'], () => {
  return gulp.src('dist/**/*').pipe($.size({
    title: 'build',
    gzip: true
  }));
});

gulp.task('default', () => {
  gulp.start('serve');
});
