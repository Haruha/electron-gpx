//Electron modules
const {
	remote,
	ipcRenderer
} = require('electron');
const dialog = remote.dialog;

//Standard file interaction module
const fs = require('fs');

//Mapbox module to convert GPX to GeoJSON
const tj = require('@mapbox/togeojson');

//DOM parser module
const DOMParser = require('xmldom').DOMParser;

//Turf.js modules
const turfNearestPointOnLine = require('@turf/nearest-point-on-line');
const turfSlice = require('@turf/line-slice');
const turfLineChunk = require('@turf/line-chunk');
const turfHelpers = require('@turf/helpers');
const turfDistance = require('@turf/distance');

//Utility function to create alerts
const {
	createAlert
} = require('./utils');

//TrackInfo class
const TrackInfo = require('./trackinfo').TrackInfo;

//MultiOptionsPolyline extension
const line = require('./multipolyline');

//Load styles for MultiOptionsPolyline
const LineStyles = require('./linestyles');

class MapManager {
	constructor() {
		//Set up empty properties
		this.loadedTracks = [];
		this.loadedCourses = [];

		this.loadedPolylines = [];
		this.loadedCourseFeatures = []

		this.loadedLinestyles = LineStyles;

		this.activeCourse = null;
		this.activeTrack = null;
		this.activeLinestyle = this.loadedLinestyles[4];

		this.closestPoints = [];

		this.endMarker = null;

		//Initialise rest of map
		this.init();
	}

	init() {
		//Create base layers for map
		this.baseLayers = [
			//Dark background map - for seeing Polylines
			{
				title: 'Dark',
				layer: L.tileLayer(
					'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
						attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
						maxZoom: 18,
						id: 'mapbox/navigation-preview-night-v4',
						accessToken: 'pk.eyJ1IjoibGlhbW1vcmR1ZTk3IiwiYSI6ImNrNDVtNWRycDBhMTcza3BqdHRkbGg5cHgifQ.L34TsN2iA8EfakcPk9TY9g',
					}),
				icon: 'resources/images/icon_map_dark.png',
			},
			//Street map - for seeing pathways and roads
			{
				title: 'Streets',
				layer: L.tileLayer(
					'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
						attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
						maxZoom: 18,
						id: 'mapbox/outdoors-v11',
						accessToken: 'pk.eyJ1IjoibGlhbW1vcmR1ZTk3IiwiYSI6ImNrNDVtNWRycDBhMTcza3BqdHRkbGg5cHgifQ.L34TsN2iA8EfakcPk9TY9g',
					}),
				icon: 'resources/images/icon_map_streets.png',
			},
			//Terrain map - for seeing contour lines
			{
				title: 'Terrain',
				layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
					maxZoom: 17,
					attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
				}),
				icon: 'resources/images/icon_map_terrain.png',
			}
		]

		//Initialise map object
		this.Map = L.map('mapid', {
			renderer: L.canvas(),
			layers: [this.baseLayers[0].layer],
		}).setView([51.505, -0.09], 13);

		//Initialise layer control HTML element
		this.iconLayersControl = new L.Control.IconLayers(
			this.baseLayers, {
				position: 'bottomleft',
				maxLayersInRow: 5
			}
		);

		this.iconLayersControl.addTo(this.Map);

		//Ensure map element sizes properly when switched to
		$('a[data-toggle="pill"]').on('shown.bs.tab', () => {
			setTimeout(() => {
				this.Map.invalidateSize();
			}, 100);
		});

		document.getElementById("overview-label-stylename").innerHTML = this.activeLinestyle.name
	}

	//Generates 1km splits for a given GeoJSON object
	generateSplitsDistance(GpxGeoJSON) {
		this.clearSplits();

		//Shorthands
		const geoFeatures = GpxGeoJSON.features[0];
		const geoProperties = geoFeatures.properties;

		//Turf function to split line up into an array of 1km length GeoJSON features
		//The remaining length that's < 1km is just added as a remainder
		let chunks = turfLineChunk(GpxGeoJSON, 1);

		//Since the above turf function doesn't copy relevant feature data over it must still be added.
		//Data such as heartrates and coordinate times are added to the features below
		let curIndex = 0;
		for (let i = 0; i < chunks.features.length; i++) {
			let currentSplit = chunks.features[i];
			let coordinates = currentSplit.geometry.coordinates;

			let a = 0;

			chunks.features[i].properties.coordTimes = [];
			if (geoProperties.heartRates) {
				chunks.features[i].properties.heartRates = [];
			}

			//Copy coordtimes and heartrates if found
			for (let x = curIndex; x < curIndex + coordinates.length; x++) {
				chunks.features[i].properties.coordTimes[a] = geoProperties.coordTimes[x];

				if (geoProperties.heartRates) {
					chunks.features[i].properties.heartRates[a] = geoProperties.heartRates[x];
				}

				a++;
			}

			//Here curIndex is used to keep track of the point index relative to the whole GeoJSON track
			curIndex = curIndex + coordinates.length - 2;
		}

		//Loop through the now edited split features and create splits based on their values
		for (let i = 0; i < chunks.features.length; i++) {

			//Create a new TrackInfo object
			let splitInfo = new TrackInfo(turfHelpers.featureCollection([chunks.features[i]]));

			let totalTime = splitInfo.getTotalTime();
			let timeString = totalTime.toTimeString().split(' ')[0];
			timeString = timeString.substring(3, timeString.length);

			let heartrate = splitInfo.getAverageHeartrate();
			if (heartrate === 0) heartrate = null;

			//Call the createSplit function and pass in an object containing split information as a parameter
			this.createSplit({
				index: i + 1,
				distance: splitInfo.getLength().toFixed(2),
				time: timeString,
				pace: splitInfo.getPace(),
				heartrate: heartrate,
			});
		}
	}

	//Generates splits between controls for given runner and course GeoJSON objects
	generateSplitsCourse() {
		//Loop through the array of the points on the current loaded track that
		//are closest to the control points
		for (let x = 0; x < this.closestPoints.length; x++) {

			//Initialise the start and stop points
			const start = this.closestPoints[x];

			let stop;
			const length = this.activeTrack.features[0].geometry.coordinates.length;

			if (!this.closestPoints[x + 1]) {
				stop = {
					properties: {
						index: this.activeTrack.features[0].geometry.coordinates.length,
					},
					geometry: {
						coordinates: [
							this.activeTrack.features[0].geometry.coordinates[length - 1][0],
							this.activeTrack.features[0].geometry.coordinates[length - 1][1],
						],
					},
				};
			} else {
				stop = this.closestPoints[x + 1];
			}

			//Place a marker on the map to denote the end of the track
			let endMarker = L.marker([
				this.activeTrack.features[0].geometry.coordinates[length - 1][1],
				this.activeTrack.features[0].geometry.coordinates[length - 1][0],
			]).addTo(this.Map);

			this.loadedCourseFeatures.push(endMarker)

			//Slice the runner's line based on the start and stop points
			const sliced = turfSlice(start, stop, this.activeTrack.features[0].geometry);

			//Copy all coordinate times and heartrates due to turf 
			//not copying them from the original feature
			sliced.properties.coordTimes = [];
			if (this.activeTrack.features[0].properties.heartRates) {
				sliced.properties.heartRates = [];
			}

			for (let dix = start.properties.index; dix < stop.properties.index; dix++) {
				sliced.properties.coordTimes.push(
					this.activeTrack.features[0].properties.coordTimes[dix]
				);

				if (this.activeTrack.features[0].properties.heartRates) {
					sliced.properties.heartRates.push(
						this.activeTrack.features[0].properties.heartRates[dix]
					);
				}
			}

			//Put the slice feature into a feature collection object 
			//then pass into TrackInfo constructor to get information on it
			let fC = turfHelpers.featureCollection([sliced]);
			let sliceInfo = new TrackInfo(fC);

			//Work out how much further the runner ran compared to the direct
			//distance between controls as a percentage

			//Direct distance
			let startPoint = turfHelpers.point(start.geometry.coordinates);
			let finishPoint = turfHelpers.point(stop.geometry.coordinates);
			let directDistance = turfDistance(startPoint, finishPoint);

			//Runner distance
			let distance = sliceInfo.getLength();
			let distanceString = distance.toFixed(2);

			//Percentage increase between the two distances
			let increase = distance - directDistance;
			let percentageIncrease = (increase / directDistance) * 100;

			//Decide which class to add to the HTML element 
			//based on the percentage increase
			let percentageClass;
			if (percentageIncrease <= 50) {
				percentageClass = 'percentage-good';
			} else if (percentageIncrease > 50 && percentageIncrease <= 100) {
				percentageClass = 'percentage-medium';
			} else {
				percentageClass = 'percentage-bad';
			}

			//Distance difference
			let distanceDifference = increase.toFixed(2);

			//Time string
			let timeString = sliceInfo
				.getTotalTime()
				.toTimeString()
				.split(' ')[0];
			timeString = timeString.substring(3, timeString.length);
			timeString = timeString.replace(/^0+/, '');
			if (timeString.charAt(0) === ':') timeString = '0' + timeString;

			let heartrate = sliceInfo.getAverageHeartrate()
			if (heartrate === 0) heartrate = ""

			//Create the split with the new information
			this.createSplit({
				index: x + 1,
				distance: distanceString,
				percentageIncrease: distanceDifference,
				percentageClass: percentageClass,
				time: timeString,
				pace: sliceInfo.getPace(),
				heartrate: heartrate
			});
		}
	}

	//Takes string representing the path to a file and renders 
	//the GPX file found at that location as a Leaflet Polyline
	renderGpxTrace(filePath) {
		let fileContents = '';

		//Get file contents
		if (fs.existsSync(filePath)) {
			fileContents = fs.readFileSync(filePath, 'utf-8');
		} else {
			dialog.showErrorBox('Error', 'Invalid file');
			return;
		}

		//Parse file contents with a DOM parser
		const domParsedGPX = new DOMParser().parseFromString(fileContents);

		//Use the Mapbox toGeoJSON module to convert 
		let GpxGeoJSON = tj.gpx(domParsedGPX, {
			styles: true,
		});

		//Regular expressions
		filePath = filePath.replace(/^.*[\\\/]/, ''); //Extract file from path
		filePath = filePath.replace(/\.[^/.]+$/, ''); //Extract name from file

		if (!GpxGeoJSON.features[0].properties.name) {
			GpxGeoJSON.features[0].properties.name = filePath;
		}

		//Get TrackInfo object for GeoJSON
		let trackInfo = new TrackInfo(GpxGeoJSON)

		for (let track of this.loadedTracks) {
			let currentName = new TrackInfo(track).getName();
			if (currentName === trackInfo.getName()) {
				//Prevent tracks with the same name from loading
				createAlert("A track with the name '" + currentName + "' already exists", "#dc3545")
				return;
			}
		}

		//Shorthands
		const geoFeatures = GpxGeoJSON.features[0];
		const geoCoords = geoFeatures.geometry.coordinates;
		const geoProperties = geoFeatures.properties;

		const latLongs = [];

		//In order to make sure expensive operations such as calculating the pace of the runner
		//at each point is only done once, calculate them all when the trace is first added to the program
		//This is especially important when the user does something computationally expensive 
		//such as re-rendering a Polyline
		for (let i = 0; i < geoCoords.length; i++) {
			const line = geoCoords[i];

			let toPush = L.latLng(line[1], line[0], line[2]);
			toPush.meta = {};

			let hRate = 100;
			if (geoProperties.heartRates) {
				hRate = geoProperties.heartRates[i];
				toPush.meta.hr = hRate;
			}

			if (geoProperties.coordTimes) {
				toPush.meta.time = new Date(geoProperties.coordTimes[i]);
			}

			//In order to get a more smooth reading for speed, group points in sets of 
			//4 and then calculate the average of speeds between consecutive points in that set

			// (0 / 4) === 0 but we want to skip the first value as there is no value for (0 - 4)
			if (i !== 0) {
				//Group in steps of 4
				let bound = 4;

				//If the current index is divisible by 4 with no remainder then start calculating speeds
				if (i % bound === 0) {
					let averageSpeed = 0;

					//Go through all points in the set to work out a total of all speeds
					for (let x = 1; x < bound; x++) {
						let segmentSpeed = latLongs[i - x].distanceTo(latLongs[i - x - 1])
						segmentSpeed /= ((latLongs[i - x].meta.time - latLongs[i - x - 1].meta.time) / 1000)
						segmentSpeed *= 3.6;

						averageSpeed = averageSpeed + Math.ceil(segmentSpeed)
					}

					//Divide the total speed by the number of values to get an average
					averageSpeed = Math.round(averageSpeed / bound);

					//Apply that average value to all points in the set
					for (let x = 1; x < bound; x++) {
						latLongs[i - x].speed = averageSpeed
					}

					toPush.speed = averageSpeed
				}
			}

			latLongs.push(toPush);
		}

		//Create a new MultiOptionsPolyline to represent the GeoJSON feature
		let polyLine = L.multiOptionsPolyline(latLongs, {
			//Apply our currently selected linestyle
			multiOptions: this.activeLinestyle.multiOptions,
			weight: 3,
			lineCap: 'butt',
			opacity: 0.75,
			smoothFactor: 1,
		});

		//Add in the original GeoJSON feature for use later
		polyLine.meta = {
			geoJSON: GpxGeoJSON,
		};

		//Add to map and then zoom to the track
		polyLine.addTo(this.Map);
		this.Map.fitBounds(polyLine.getBounds());

		//Initialise our HTML legend to allow us to remove and zoom to the track
		let legend = {
			name: trackInfo.getName(),
			layer: polyLine,
			opacity: 1,
			elements: [{
				label: '',
				html: '',
				style: {},
			}, ],
		};

		//Place the new legend in the top right of the screen
		let htmlLegend = L.control.htmllegend({
			position: 'topright',
			legends: [legend],
			collapsedOnInit: true,
		});

		this.Map.addControl(htmlLegend);

		//Append the GeoJSON and Polyline to their respective loaded arrays
		this.loadedTracks.push(GpxGeoJSON);
		this.loadedPolylines.push(polyLine);

		//Force an update across all JavaScript files
		ipcRenderer.send('sendTrack', polyLine.meta.geoJSON);
		ipcRenderer.send('activeTrack', trackInfo.getName());
		ipcRenderer.send('requestTracks');

		//Inform the user their track was successfully added
		createAlert('Successfully added runner track from file: ' + filePath);
	}

	//Handles course file loading
	manageCourseLoading(filePath) {
		let fileContents = '';

		//Read file contents
		if (fs.existsSync(filePath)) {
			fileContents = fs.readFileSync(filePath, 'utf-8');
		} else {
			dialog.showErrorBox('Error', 'Invalid file');
			return;
		}

		//Get file name from path
		filePath = filePath.replace(/^.*[\\\/]/, ''); //Extract file from path
		filePath = filePath.replace(/\.[^/.]+$/, ''); //Extract name from file

		//As with normal runner loading
		const domParsedGPX = new DOMParser().parseFromString(fileContents);
		const GpxGeoJSON = tj.gpx(domParsedGPX, {
			styles: true,
		});

		//Check there isn't already a course loaded with the same name
		for (let i = 0; i < this.loadedCourses.length; i++) {
			if (this.loadedCourses[i].properties.name === filePath + " - " + GpxGeoJSON.features[i].properties.name) {
				createAlert("A course with the name '" + this.loadedCourses[i].properties.name + "' already exists", "#dc3545")
				return;
			}
		}

		//Add all found course features in a course file
		for (let i = 0; i < GpxGeoJSON.features.length; i++) {
			let currentFeature = GpxGeoJSON.features[i];

			//Concat the filepath and feature name to distinguish between courses that might have the same track names
			currentFeature.properties.name = filePath + " - " + currentFeature.properties.name

			//Only the features with the "LineString" types are needed
			//All other features in the file are generally points which represent controls
			//These aren't needed as the LineString coordinates are the exact same thing
			if (currentFeature.geometry.type === "LineString") {
				this.loadedCourses.push(currentFeature);
				createAlert("Successfully added course track '" + currentFeature.properties.name + "'");

				//Update the list of courses
				ipcRenderer.send('sendCourse', currentFeature);
			}
		}
	}

	//Resonsible for rendering a course feature on the map
	renderGpxCourse(currentFeature) {
		this.clearSplits();

		//Remove any old features related to a previous course such a circle markers, icon markers, lines etc.
		for (let i = 0; i < this.loadedCourseFeatures.length; i++) {
			let oldFeature = this.loadedCourseFeatures[i];
			oldFeature.remove();
		}

		this.closestPoints = [];

		//Create a new Point feature for each coordinate in the LineString feature
		//These Points represent each control in the course
		for (let x = 0; x < currentFeature.geometry.coordinates.length; x++) {
			let geojsonFeature = {
				type: 'Feature',
				properties: {
					name: currentFeature.properties.name,
				},
				geometry: {
					type: 'Point',
					coordinates: currentFeature.geometry.coordinates[x],
				},
			};

			//Add circle markers to the map to visually display the controls
			let point = L.geoJSON(geojsonFeature, {
				pointToLayer: function (feature, latlng) {
					return L.circleMarker(latlng, {
						radius: 10,
						fillColor: '#42A6C6',
						color: '#42A6C6',
						weight: 2,
						opacity: 1,
						fillOpacity: 0.4,
					});
				},
			}).addTo(this.Map);
			this.loadedCourseFeatures.push(point);


			//Add circle markers for the nearest points on the runner's line to the course controls
			let closestPoint = turfNearestPointOnLine(this.activeTrack.features[0], geojsonFeature);
			this.closestPoints.push(closestPoint);

			let marker = L.geoJSON(closestPoint, {
				pointToLayer: function (feature, latlng) {
					return L.circleMarker(latlng, {
						radius: 10,
						fillColor: '#FF9900',
						color: '#FF9900',
						weight: 2,
						opacity: 1,
						fillOpacity: 0.4,
					});
				},
			}).addTo(this.Map);

			this.loadedCourseFeatures.push(marker);
		}

		//Render the course line feature
		var line = L.geoJSON(currentFeature, {
			style: {
				color: '#42A6C6',
				weight: 3,
				opacity: 0.65,
			},
		}).addTo(this.Map);
		this.loadedCourseFeatures.push(line);

		ipcRenderer.send('sendClosestPoints', this.closestPoints)

		//Generate the splits for this course and the active runner track
		this.generateSplitsCourse();
	}

	//Utility function to create a split
	createSplit(features) {
		//Formatting changes
		if (!features.percentageIncrease) features.percentageIncrease = '';
		if (features.percentageIncrease !== '') {
			features.percentageIncrease = '+' + features.percentageIncrease + 'km';
		}
		if (!features.percentageClass) features.percentageClass = 'text-muted';

		//Template literal holds HTML to be added to the split list
		//Function parameter object's properties are added in as embedded expressions
		let split = `
		<div class="card split">
			<div class="card-header bg-dark-primary split-header" id="card-heading-${features.index}">
				<h2 class="mb-0 btn bg-dark-primary collapsible-button panel-title no-padding split-header"
					data-toggle="collapse" data-target="#collapsible-${features.index}"
					aria-expanded="true" aria-controls="collapsible-${features.index}">
					Split ${features.index}
					</button>
				</h2>
			</div>
	
			<div id="collapsible-${features.index}" class="collapse show" aria-labelledby="card-heading-${features.index}"
				data-parent="#accordionExample">
				<div class="card-body" style="height: 100%; padding: 0 16px 0 16px;">
					<table class="table table-sm"
						style="margin: 2px 0px 2px 0px;">
						<tr>
							<td class="split-table-entry">
								<div class="text-muted">Time taken</div>
								<div>${features.time}</div>
							</td>
							<td class="split-table-entry">
								<div class="text-muted">Distance</div>
								<div class="percentage-wrapper">
									<div>${features.distance}km</div>
									<div data-toggle="tooltip" title="Distance difference from direct distance to runner's distance" class="percentage-text ${features.percentageClass}">${features.percentageIncrease}</div>
								</div>
							</td>
						</tr>
						<tr>
							<td class="split-table-entry split-table-divider">
								<div class="text-muted">Pace</div>
								<div>${features.pace}/km</div>
							</td>
							<td class="split-table-entry split-table-divider">
								<div class="text-muted">Heartrate</div>`;

		if (features.heartrate) {
			split += `<div>${features.heartrate}bpm</div>`;
		} else {
			split += `<div>N/A</div>`;
		}
		`</td> 
						</tr>
					</table>
				</div>
			</div> 
		</div>`;

		$('#way-list').append(split);
	}

	//Takes the list of splits and clears all HTML elements in it
	clearSplits() {
		const list = document.getElementById('way-list');
		while (list.firstChild) {
			if (list.firstChild === list.lastChild) break;
			//Due to the splits being part of an accordion element which is the first child element
			//make sure to not remove it and instead remove the following child
			if (list.lastChild === document.getElementById('accordionExample')) {
				if (list.lastChild.previousSibling) {
					list.removeChild(list.lastChild.previousSibling);
				}
			} else {
				list.removeChild(list.lastChild);
			}
		}
	}

	//Forces all MultiOptionsPolylines to redraw with a new set of options
	refreshLines() {

		//Loop all loaded Polylines
		for (const index in this.loadedPolylines) {
			const line = this.loadedPolylines[index];

			//Get the new selected line stype
			this.activeLinestyle = this.loadedLinestyles.filter(obj => {
				return obj.name === remote.getGlobal('lineStyle');
			})[0];

			//Update multioptions
			line._options.multiOptions = this.activeLinestyle.multiOptions;

			//Update line's main options with new multioptions
			line.setStyle({
				multiOptions: this.activeLinestyle.multiOptions,
				weight: 3,
				opacity: 1,
				lineCap: 'butt',
				smoothFactor: 1,
			});

			//Calling setLatLngs() forces the lines to redraw with their new options
			//Just calling setStyle() alone isn't enough to trigger a redraw
			line.setLatLngs(line._originalLatlngs);
		}
	}

	//Opens a filepicker dialog that only accepts singular files with the '.gpx' extension
	loadGpxCourse() {
		dialog
			.showOpenDialog({
				title: 'Select GPX Course file',
				filters: [{
					name: 'GPX Files',
					extensions: ['gpx'],
				}, ],
				properties: ['openFile'],
			})
			.then(data => {
				if (data.canceled) return;

				//Pass the filepath to load as a course
				this.manageCourseLoading(data.filePaths[0]);
			});
	}

	//Opens a filepicker dialog that only accepts singular files with the '.gpx' extension
	loadGpxFile() {
		dialog
			.showOpenDialog({
				title: 'Select GPX track',
				filters: [{
					name: 'GPX Files',
					extensions: ['gpx'],
				}, ],
				properties: ['openFile'],
			})
			.then(data => {
				if (data.canceled) return;

				//Pass the filepatch to load as a runner track
				this.renderGpxTrace(data.filePaths[0]);
			});
	}

	//Opens a filepicker dialog that accepts all files in a folder with the '.gpx' extension
	loadGpxFolder() {
		dialog
			.showOpenDialog({
				title: 'Select GPX folder',
				properties: ['openDirectory'],
			})
			.then(data => {
				if (data.canceled) return;

				//Loop all filepaths of the folder items and render as traces
				fs.readdir(data.filePaths[0], (err, dir) => {
					for (let i = 0, path;
						(path = dir[i]); i++) {
						if (!path.endsWith('.gpx')) continue;
						this.renderGpxTrace(data.filePaths[0] + '/' + path);
					}
				});
			});
	}
}

//Create the main MapManager object to allow for networking listeners to interact
let mapManager = new MapManager();


//Called when the main process replies with an updated linestyle
ipcRenderer.on('replyStyle', (event, arg) => {
	document.getElementById("overview-label-stylename").innerHTML = arg

	//Since all line styles have been updated, force a refresh of the lines
	mapManager.refreshLines();
});

//Request the main process updates the tracks when we first load the program
ipcRenderer.send('requestTracks');


//Called when the main process replies with an updated active track
ipcRenderer.on('replyActiveTrack', (event, arg) => {
	for (let i = 0; i < mapManager.loadedTracks.length; i++) {
		if (arg === mapManager.loadedTracks[i].features[0].properties.name) {
			let trackInfo = new TrackInfo(mapManager.loadedTracks[i])
			mapManager.activeTrack = mapManager.loadedTracks[i]

			//Update overview labels based on track information
			document.getElementById("overview-label-trackname").innerHTML = arg

			let timeString = trackInfo.getTotalTime()

			let minutes = timeString.getMinutes()
			if (minutes < 10) minutes = "0" + minutes;

			let seconds = timeString.getSeconds()
			if (seconds < 10) seconds = "0" + seconds;
			timeString = timeString.getHours() + ":" + minutes + ":" + seconds

			document.getElementById("overview-label-time").innerHTML = timeString;
			document.getElementById("overview-label-pace").innerHTML = trackInfo.getPace() + "/km"
			document.getElementById("overview-label-trackdistance").innerHTML = trackInfo.getLength().toFixed(2) + "km";
			document.getElementById("overview-label-elevation").innerHTML = trackInfo.getNetElevationDiff() + "m";

			document.getElementById("overview-label-heartrate").innerHTML = trackInfo.getAverageHeartrate() + "bpm";
			if (trackInfo.getAverageHeartrate() === 0) {
				document.getElementById("overview-label-heartrate").innerHTML = "N/A"
			}

			//If we have a course loaded, re-render the course for the active line
			if (mapManager.activeCourse) {
				mapManager.renderGpxCourse(mapManager.activeCourse);
			} else {
				//Otherwise just generate 1km splits
				mapManager.generateSplitsDistance(mapManager.loadedTracks[i]);
			}
		}
	}
});

//Called when the main process replies with an updated active course
//Gets the course feature by name and calls for it to be rendered on the map
ipcRenderer.on('replyActiveCourse', (event, arg) => {
	for (let i = 0; i < mapManager.loadedCourses.length; i++) {
		if (arg === mapManager.loadedCourses[i].properties.name) {

			let distanceString = new TrackInfo(turfHelpers.featureCollection([mapManager.loadedCourses[i]])).getLength().toFixed(2) + "km"

			document.getElementById("overview-label-coursename").innerHTML = arg;
			document.getElementById("overview-label-coursedistance").innerHTML = distanceString;

			mapManager.activeCourse = mapManager.loadedCourses[i]
			mapManager.renderGpxCourse(mapManager.activeCourse);
		}
	}
});

//Called when the main process returns a list of active tracks
//Mostly used to ensure
ipcRenderer.on('returnTracks', (event, arg) => {
	mapManager.loadedTracks = arg[0]
})

//Export functions for use in the top "file, edit, view" menu
module.exports = {
	pickGpxFile: function () {
		mapManager.loadGpxFile();
	},
	pickGpxFolder: function () {
		mapManager.loadGpxFolder();
	},
	pickGpxCourse: function () {
		mapManager.loadGpxCourse();
	},
};