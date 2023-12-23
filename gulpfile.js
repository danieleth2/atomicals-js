
// using data from package.json
var pkg = require('./package.json');
var source = require('vinyl-source-stream');
var banner = ['/**',
' * <%= pkg.name %> - <%= pkg.description %>',
' * @version v<%= pkg.version %>',
' * @link <%= pkg.homepage %>',
' *',
' * Copyright (c) 2023 The Atomicals Developers - atomicals.xyz',
' *',
' * This program is free software: you can redistribute it and/or modify',
' * it under the terms of the GNU General Public License as published by',
' * the Free Software Foundation, either version 3 of the License, or',
' * (at your option) any later version.',
' * ',
' * This program is distributed in the hope that it will be useful,',
' * but WITHOUT ANY WARRANTY; without even the implied warranty of',
' * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
' * GNU General Public License for more details.',
' * ',
' * You should have received a copy of the GNU General Public License',
' * along with this program.  If not, see <https://www.gnu.org/licenses/>.',
' */',
''].join('\n');

var gulp = require('gulp');
var ts = require('gulp-typescript');
var header = require('gulp-header');
var rename = require("gulp-rename");

var uglify = require('gulp-uglify');

// Load plugins

gulp.task('build', function () {
  return gulp.src('lib/**/*.ts')
      .pipe(ts({
          noImplicitAny: false,
          // outFile: 'atomicals.js',
          // module: 'amd'
      }))
      .pipe(header(banner, { pkg : pkg } ))
      .pipe(uglify())
      .pipe(rename("atomicals.js"))
      .pipe(gulp.dest('dist'));
});
