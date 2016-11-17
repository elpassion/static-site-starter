import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import browserSync from 'browser-sync';
import del from 'del';
import sassModuleImporter from 'sass-module-importer';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

function lint(files) {
  return () => {
    return gulp.src(files)
      .pipe($.plumber({
        errorHandler(err) {
          console.log(err); // eslint-disable-line no-console
          this.emit('end');
        }
      }))
      .pipe(reload({
        stream: true,
        once: true
      }))
      .pipe($.eslint())
      .pipe($.eslint.format())
      .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
  };
}

gulp.task('styles', () => {
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

gulp.task('lint', lint('./src/scripts/**/*.js'));
gulp.task('lint:test', lint('test/spec/**/*.js'));

gulp.task('scripts', () => {
  return gulp.src('./src/scripts/**/*.js')
    .pipe($.sourcemaps.init({
      loadMaps: true
    }))
    .pipe($.babel({
      presets: ['es2015', 'stage-0']
    }))
    .pipe($.plumber({
      errorHandler(err) {
        console.log(err); // eslint-disable-line no-console
        this.emit('end');
      }
    }))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('./dist/js'))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('hbs', () => {
  return gulp.src('./src/hbs/*.html')
    .pipe($.plumber())
    .pipe($.frontMatter())
    .pipe($.hb({
      bustCache: true,
      debug: true,
      partials: './src/hbs/partials/**/*.hbs',
      helpers: [
        './src/hbs/helpers/repeat.js',
        './node_modules/handlebars-helpers/lib/helpers/helpers-files.js',
        './node_modules/handlebars-helpers/lib/helpers/helpers-comparisons.js',
        './node_modules/handlebars-helpers/lib/helpers/helpers-collections.js',
        './node_modules/handlebars-helpers/lib/helpers/helpers-strings.js',
        './node_modules/handlebars-helpers/lib/helpers/helpers-math.js',
      ]
    }))
    .pipe(gulp.dest('./dist'))
    .pipe(reload({
      stream: true
    }));
});

gulp.task('html', ['hbs', 'styles', 'scripts'], () => {
  return gulp.src('./src/*.html')
    .pipe($.useref())
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.minifyCss({
      compatibility: '*'
    })))
    .pipe($.if('*.html', $.minifyHtml({
      conditionals: true,
      loose: true
    })))
    .pipe(gulp.dest('./dist'));
});

gulp.task('images', () => {
  return gulp.src('./src/images/**/*')
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
      directory: true
    }
  });

  $.watch(['./src/hbs/partials/**/*.hbs', './src/hbs/*.html'], () => {
    gulp.start('hbs');
  });

  $.watch('./src/scripts/**/*.js', () => {
    gulp.start('scripts');
    gulp.start('lint');
  });

  $.watch('./src/styles/**/*.scss', () => {
    gulp.start('styles');
  });

  gulp.watch([
    './src/*.html',
    './src/js/*.js',
    './src/images/**/*',
  ]).on('change', reload);
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

gulp.task('default', ['clean'], () => {
  gulp.start('serve');
});
