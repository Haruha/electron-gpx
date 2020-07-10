/*Edited version of - https://github.com/hgoebl/Leaflet.MultiOptionsPolyline

The MIT License (MIT)

Copyright (c) 2014 Heinrich Goebl

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

const MultiOptionsPolyline = L.FeatureGroup.extend({

    initialize: function (latlngs, options) {
        const copyBaseOptions = options.multiOptions.copyBaseOptions;

        this._layers = {};
        this._options = options;
        if (copyBaseOptions === undefined || copyBaseOptions) {
            this._copyBaseOptions();
        }

        this.setLatLngs(latlngs);
    },

    _copyBaseOptions: function () {
        let multiOptions = this._options.multiOptions,
            baseOptions,
            optionsArray = multiOptions.options,
            i, len = optionsArray.length;

        baseOptions = L.extend({}, this._options);
        delete baseOptions.multiOptions;

        for (i = 0; i < len; ++i) {
            optionsArray[i] = L.extend({}, baseOptions, optionsArray[i]);
        }
    },

    setLatLngs: function (latlngs) {
        let i, len = latlngs.length,
            multiOptions = this._options.multiOptions,
            optionIdxFn = multiOptions.optionIdxFn,
            fnContext = multiOptions.fnContext || this,
            prevOptionIdx, optionIdx,
            segmentLatlngs;

        this._originalLatlngs = latlngs;

        fnContext.maxAltitude = 0;
        fnContext.minAltitude = Infinity;


        for (x = 0; x < latlngs.length; x++) {
            if (latlngs[x].alt < fnContext.minAltitude) fnContext.minAltitude = latlngs[x].alt;
            if (latlngs[x].alt > fnContext.maxAltitude) fnContext.maxAltitude = latlngs[x].alt;
        }

        this.eachLayer(function (layer) {
            this.removeLayer(layer);
        }, this);

        for (i = 1; i < len; ++i) {
            optionIdx = optionIdxFn.call(
                fnContext, latlngs[i], latlngs[i - 1], i, latlngs);

            if (i === 1) {
                segmentLatlngs = [latlngs[0]];
                prevOptionIdx = optionIdxFn.call(fnContext, latlngs[0], latlngs[0], 0, latlngs);
            }

            segmentLatlngs.push(latlngs[i]);

            if (prevOptionIdx !== optionIdx || i === len - 1) {
                if (typeof multiOptions.options === "function") {
                    this.addLayer(L.polyline(segmentLatlngs, multiOptions.options(prevOptionIdx)));
                } else {
                    this.addLayer(L.polyline(segmentLatlngs, multiOptions.options[prevOptionIdx]));
                }

                prevOptionIdx = optionIdx;
                segmentLatlngs = [latlngs[i]];
            }
        }

        return this;
    },

    getLatLngs: function () {
        return this._originalLatlngs;
    },

    getLatLngsSegments: function () {
        const latlngs = [];

        this.eachLayer(function (layer) {
            latlngs.push(layer.getLatLngs());
        });

        return latlngs;
    }
});

L.MultiOptionsPolyline = MultiOptionsPolyline;
L.multiOptionsPolyline = function (latlngs, options) {
    return new MultiOptionsPolyline(latlngs, options);
};