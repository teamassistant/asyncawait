var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var Buffer = require('buffer').Buffer;
var _ = require('lodash');
var co = require('co');


/**
  * FUNCTION: largest-co (see https://github.com/visionmedia/co)
  * Finds the largest file in the given directory, optionally performing a recursive search.
  *
  * PARAMETERS:
  * - dir: string
  * - options?: { recurse?: boolean; preview?: boolean }
  *
  * RETURNS:
  * - null if no files found -or-
  * - { path: string; size: number; preview?: string, searched: number; }
  */
var largest = co(function* (dir, options, internal) {

    // Parse arguments
    options = options || largest.options;

    // Enumerate all files and subfolders in 'dir' to get their stats.
    var files = yield fs.readdirAsync(dir);
    var paths = _.map(files, function (file) { return path.join(dir, file); });
    var stats = yield _.map(paths, function (path) { return fs.statAsync(path); });

    // Build up a list of possible candidates, recursing into subfolders.
    var candidates = yield _.map(stats, function (stat, i) {
        if (stat.isFile()) return { path: paths[i], size: stat.size, searched: 1 };
        return options.recurse ? largest(paths[i], options, true) : null;
    });

    // Choose the best candidate.
    var result = _(candidates)
        .filter(function (cand) { return cand; })
        .reduce(function (best, cand) {
            if (cand.size > best.size) var temp = cand, cand = best, best = temp;
            best.searched += cand.searched;
            return best;
        });

    // Add a preview if requested (but skip if this is an internal step in a recursive search).
    if (result && options.preview && !internal) {
        var fd = yield fs.openAsync(result.path, 'r');
        var buffer = new Buffer(40);
        var bytesRead = (yield fs.readAsync(fd, buffer, 0, 40, 0))[0];
        result.preview = buffer.toString('utf-8', 0, bytesRead);
        yield fs.closeAsync(fd);
    }
    return result;
});
largest.options = {};


module.exports = largest;