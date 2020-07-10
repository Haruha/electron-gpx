//Line styles adapted from original Leaflet.MultiOptionsPolyline library example
//https://github.com/hgoebl/Leaflet.MultiOptionsPolyline

//Load Chroma.js for generating colours
const chroma = require("chroma-js");

//Utility function for formatting colour array
function formatColors(toFormat) {
    let toReturn = [];
    let item;
    for (item of toFormat) {
        toReturn.unshift({
            color: item
        });
    }

    return toReturn;
}

//Directly export line styles from module
module.exports = [
    incline = {
        //Splits all LatLngs into 60 'slots'
        //Calculates incline for those 60 slots
        name: "Clustered Incline",
        multiOptions: {
            fnContext: {
                lastSlot: -1,
                lastOptionIdx: 0
            },
            name: "Clustered Incline",
            optionIdxFn: function (latLng, prevLatLng, index, points) {
                let i, deltaAltitude, deltaTime, incline, startIndex, endIndex,
                    gain,
                    slot, slotSize = Math.floor(points.length / 60);

                const min = 0;
                const max = 800;
                const step = ((max - min) / 20);

                const thresholds = [];

                for (let x = min; x <= max; x = x + step) {
                    thresholds.push(x);
                }

                slot = Math.floor(index / slotSize);
                if (slot === this.lastSlot) {
                    return this.lastOptionIdx;
                }

                this.lastSlot = slot;
                startIndex = slot * slotSize;
                endIndex = Math.min(startIndex + slotSize, points.length) - 1;
                gain = 0;
                for (i = startIndex + 1; i <= endIndex; ++i) {
                    deltaAltitude = points[i].alt - points[i - 1].alt;
                    if (deltaAltitude > 0) {
                        gain += deltaAltitude;
                    }
                }
                deltaTime = (points[endIndex].meta.time - points[startIndex].meta.time) / 1000; //sec
                incline = 3600 * gain / deltaTime; //m/h

                if (isNaN(incline)) {
                    return (this.lastOptionIdx = 4); //Neutral
                }

                for (i = 0; i < thresholds.length; ++i) {
                    if (incline <= thresholds[i]) {
                        break;
                    }
                }
                return (this.lastOptionIdx = i);
            },
            options: formatColors(chroma.scale('RdYlBu').mode("lch").colors(20))

        }
    },

    altitude = {
        //Takes the 'alt' property of each LatLng
        //Returns a colour based on that 'alt'
        name: "Altitude",
        multiOptions: {
            name: "Altitude",
            optionIdxFn: function (latLng, ) {
                let i, alt = latLng.alt;
                const zones = [];

                const lowerBound = this.minAltitude - 10;
                const upperBound = this.maxAltitude + 10;
                for (let x = lowerBound; x < upperBound; x = x + ((upperBound - lowerBound) / 20)) {
                    zones.push(x);
                }

                if (!alt) {
                    return 0;
                }

                for (i = 0; i < zones.length; ++i) {
                    if (alt <= zones[i]) {
                        return i;
                    }
                }
                return zones.length;
            },

            options: formatColors(chroma.scale(['#7F0000', '#FC8D59', '#FFF7EC']).colors(20))
        }
    },

    heartrate = {
        //Takes the previously stored heartrate property of each LatLng
        //Returns a colour based on how high/low that heartrate is
        name: "Heartrate",
        multiOptions: {
            name: "Heartrate",
            optionIdxFn: function (latLng) {
                //Current track doesn't have heartrates stored
                if (!latLng.meta.hr) return 0;

                let i, hr = latLng.meta.hr;
                const zones = [];
                for (let x = 90; x < 190; x = x + 5) {
                    zones.push(x);
                }

                for (i = 0; i < zones.length; ++i) {
                    if (hr <= zones[i]) {
                        return i;
                    }
                }
                return zones.length;
            },

            options: formatColors(chroma.scale('RdYlBu').mode("lch").colors(20)),
        }
    },

    solid = {
        //Solid colour for the line
        name: "Solid fill",
        multiOptions: {
            name: "Solid fill",
            optionIdxFn: function (latLng) {
                return 0;
            },

            options: [{
                //Generate a random colour
                color: "#" + ((1 << 24) * Math.random() | 0).toString(16)
            }],
        }
    },

    speed = {
        //Use previously calculated speed values from mapfuncs.js
        name: "Speed",
        multiOptions: {
            name: "Speed",
            optionIdxFn: function (latLng, prevLatLng, index) {
                if (prevLatLng && !latLng.speed) {
                    latLng.speed = prevLatLng.speed || 0
                }

                return latLng.speed
            },
            options: formatColors(chroma.scale('RdYlBu').mode("lch").colors(20)),
        }
    }
]