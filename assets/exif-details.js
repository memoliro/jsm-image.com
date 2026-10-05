/* exif-details.js — pure helpers that turn an exif-js tag object into readable,
   grouped HTML for the "Show metadata details" section of remove-exif.html.
   No DOM access here: everything is string-in/string-out so it can be unit
   tested in Node. The page wires it up; see remove-exif.html.
   (exif-js itself is MIT-licensed; vendored at /assets/exif.min.js) */
(function (root) {
  'use strict';

  // Tag names that are internal pointers or binary blobs — meaningless to users.
  var SKIP = {
    thumbnail: 1, MakerNote: 1,
    ExifIFDPointer: 1, GPSInfoIFDPointer: 1, InteroperabilityIFDPointer: 1
  };

  var GROUPS = [
    { name: 'Camera', tags: ['Make', 'Model', 'LensMake', 'LensModel', 'Software', 'HostComputer'] },
    { name: 'Date & time', tags: ['DateTime', 'DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate', 'GPSDateStamp', 'GPSTimeStamp', 'OffsetTime', 'OffsetTimeOriginal', 'OffsetTimeDigitized'] },
    { name: 'Exposure', tags: ['ExposureTime', 'FNumber', 'ISOSpeedRatings', 'ExposureProgram', 'ExposureBias', 'ExposureBiasValue', 'ExposureMode', 'ExposureIndex', 'MeteringMode', 'LightSource', 'Flash', 'FocalLength', 'FocalLengthIn35mmFilm', 'MaxApertureValue', 'ApertureValue', 'ShutterSpeedValue', 'BrightnessValue', 'WhiteBalance', 'DigitalZoomRation', 'DigitalZoomRatio', 'SceneCaptureType', 'SceneType', 'Contrast', 'Saturation', 'Sharpness', 'GainControl', 'SubjectDistance', 'SubjectDistanceRange', 'SensingMethod', 'FileSource', 'CustomRendered'] },
    { name: 'GPS', tags: ['GPSLatitudeRef', 'GPSLatitude', 'GPSLongitudeRef', 'GPSLongitude', 'GPSAltitudeRef', 'GPSAltitude', 'GPSSatellites', 'GPSStatus', 'GPSMeasureMode', 'GPSDOP', 'GPSSpeedRef', 'GPSSpeed', 'GPSTrackRef', 'GPSTrack', 'GPSImgDirectionRef', 'GPSImgDirection', 'GPSMapDatum', 'GPSDestLatitudeRef', 'GPSDestLatitude', 'GPSDestLongitudeRef', 'GPSDestLongitude', 'GPSProcessingMethod', 'GPSAreaInformation'] },
    { name: 'Image', tags: ['Orientation', 'XResolution', 'YResolution', 'ResolutionUnit', 'PixelXDimension', 'PixelYDimension', 'ImageWidth', 'ImageLength', 'ColorSpace', 'ComponentsConfiguration', 'YCbCrPositioning', 'ExifVersion', 'FlashpixVersion', 'ImageDescription', 'Artist', 'Copyright', 'UserComment', 'XPComment', 'XPTitle', 'XPAuthor'] }
  ];

  var ORIENTATION = { 1: 'Normal', 2: 'Flipped horizontally', 3: 'Rotated 180°', 4: 'Flipped vertically', 5: 'Rotated 90° CCW + flipped', 6: 'Rotated 90° CW', 7: 'Rotated 90° CW + flipped', 8: 'Rotated 90° CCW' };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function round(n, digits) {
    var p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  }

  // Convert exif-js GPS arrays like [43,28,2.814] + 'N' to decimal degrees.
  // Returns null when the input is malformed. Never throws.
  function dmsToDecimal(dms, ref) {
    try {
      if (!Array.isArray(dms) || dms.length < 3) return null;
      var d = Number(dms[0]), m = Number(dms[1]), s = Number(dms[2]);
      if (!isFinite(d) || !isFinite(m) || !isFinite(s)) return null;
      var dec = Math.abs(d) + m / 60 + s / 3600;
      if (ref === 'S' || ref === 'W') dec = -dec;
      return round(dec, 6);
    } catch (e) { return null; }
  }

  function formatDms(dms, ref) {
    if (!Array.isArray(dms) || dms.length < 3) return null;
    return dms[0] + '° ' + dms[1] + '′ ' + round(Number(dms[2]), 2) + '″ ' + (ref || '');
  }

  function formatDateTime(v) {
    // EXIF stamps look like "2008:10:22 16:28:39" — render with dashes.
    var m = /^(\d{4}):(\d{2}):(\d{2})(.*)$/.exec(String(v));
    return m ? m[1] + '-' + m[2] + '-' + m[3] + m[4] : String(v);
  }

  function formatValue(name, v) {
    v = unbox(v);
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') {
      if (name === 'ExposureTime') return v < 1 ? '1/' + Math.round(1 / v) + ' s' : v + ' s';
      if (name === 'FNumber' || name === 'ApertureValue' || name === 'MaxApertureValue') return 'f/' + round(v, 1);
      if (name === 'FocalLength' || name === 'FocalLengthIn35mmFilm') return round(v, 1) + ' mm';
      if (name === 'GPSAltitude') return round(v, 1) + ' m';
      if (name === 'ISOSpeedRatings' || name === 'PhotographicSensitivity') return 'ISO ' + v;
      if (name === 'Flash') return ((v & 1) ? 'Fired' : 'Did not fire') + ' (code ' + v + ')';
      if (name === 'Orientation') return ORIENTATION[v] ? ORIENTATION[v] + ' (' + v + ')' : String(v);
      if (name === 'XResolution' || name === 'YResolution') return v + ' dpi';
      return String(round(v, 4));
    }
    if (typeof v === 'string') {
      var s = v;
      if (/^DateTime|^GPSDateStamp$/.test(name) || name === 'CreateDate' || name === 'ModifyDate') s = formatDateTime(v);
      // Binary junk sometimes hides in text tags — truncate hard.
      if (s.length > 120) s = s.slice(0, 120) + '…';
      return s;
    }
    if (Array.isArray(v)) {
      if (name === 'GPSTimeStamp') return v.map(function (x) { return round(Number(x), 2); }).join(':') + ' UTC';
      return v.map(function (x) { return String(x); }).join(', ');
    }
    return String(v);
  }

  // exif-js 2.3.0 returns some rational tags as boxed Number objects
  // (typeof 'object', not primitives). Unwrap them so formatting works.
  function unbox(v) {
    if (v instanceof Number || v instanceof String) return v.valueOf();
    return v;
  }

  function isDisplayable(v) {
    v = unbox(v);
    if (v === null || v === undefined) return false;
    if (typeof v === 'object' && !Array.isArray(v)) return false; // Uint8Array blobs etc.
    if (typeof v === 'string' && v.length === 0) return false;
    return true;
  }

  // Group an exif-js tag object into ordered [{name, rows:[[label, html], ...]}].
  // GPS lat/lon collapse into one "Coordinates" row with DMS + decimal.
  // Returns {groups, count}.
  function groupTags(tags) {
    tags = tags || {};
    var seen = {}, groups = [], count = 0;

    function addRow(group, label, html) {
      group.rows.push([label, html]); count++;
    }

    GROUPS.forEach(function (g) {
      var group = { name: g.name, rows: [] };
      g.tags.forEach(function (t) {
        if (SKIP[t] || seen[t] || !isDisplayable(tags[t])) return;
        seen[t] = 1;
        // GPS lat/lon are handled as a combined Coordinates row below.
        if (t === 'GPSLatitude' || t === 'GPSLatitudeRef' || t === 'GPSLongitude' || t === 'GPSLongitudeRef') return;
        addRow(group, t, escapeHtml(formatValue(t, tags[t])));
      });
      if (group.name === 'GPS') {
        var latDec = dmsToDecimal(tags.GPSLatitude, tags.GPSLatitudeRef);
        var lonDec = dmsToDecimal(tags.GPSLongitude, tags.GPSLongitudeRef);
        if (latDec !== null && lonDec !== null) {
          seen.GPSLatitude = seen.GPSLatitudeRef = seen.GPSLongitude = seen.GPSLongitudeRef = 1;
          var dms = formatDms(tags.GPSLatitude, tags.GPSLatitudeRef) + ', ' + formatDms(tags.GPSLongitude, tags.GPSLongitudeRef);
          // NOTE: decimal shown as plain text on purpose — no map link, so the
          // coordinates are never sent to an external service.
          addRow(group, 'Coordinates', escapeHtml(dms) + '<br><span class="coord-dec">' + latDec + ', ' + lonDec + '</span>');
        }
      }
      if (group.rows.length) groups.push(group);
    });

    // Anything not in the known lists goes under "Other".
    var other = { name: 'Other', rows: [] };
    Object.keys(tags).forEach(function (t) {
      if (SKIP[t] || seen[t] || !isDisplayable(tags[t])) return;
      seen[t] = 1;
      addRow(other, t, escapeHtml(formatValue(t, tags[t])));
    });
    if (other.rows.length) groups.push(other);
    return { groups: groups, count: count };
  }

  // Render grouped tags as table HTML (string). Pure — no DOM.
  function renderDetails(tags) {
    var g = groupTags(tags);
    if (!g.count) return { html: '', count: 0 };
    var html = '';
    g.groups.forEach(function (gr) {
      html += '<tr class="detail-group"><td colspan="2">' + escapeHtml(gr.name) + '</td></tr>';
      gr.rows.forEach(function (r) {
        html += '<tr><td>' + escapeHtml(r[0]) + '</td><td>' + r[1] + '</td></tr>';
      });
    });
    return { html: html, count: g.count };
  }

  var api = {
    dmsToDecimal: dmsToDecimal,
    formatValue: formatValue,
    groupTags: groupTags,
    renderDetails: renderDetails
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExifDetails = api;
})(typeof self !== 'undefined' ? self : this);
