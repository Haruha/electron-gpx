//Load turf.js functions

//Measures the length of a given GeoJSON object
const turfLength = require('@turf/length').default;

//Calculates the distance between 2 given points
const turfDistance = require('@turf/distance');

//Constructs a Point object
const turfPoint = require('@turf/helpers').point;

//Class that takes a GeoJSON object as a constructor parameter
//Used to return useful information about that GeoJSON object
//e.g. average pace, distance ran, average heartrate (if available)
class TrackInfo {
	//Pass in any FeatureCollection object that holds a single feature
	constructor(geoJSON) {
		this.geoJSON = geoJSON;

		//Shorthands for coordinates and properties
		this.points = this.geoJSON.features[0].geometry.coordinates
		this.properties = this.geoJSON.features[0].properties

		//Log the highest and lowest elevations
		this.elevationStart = this.points[0][2];
		this.elevationHighest = this.elevationStart;
		this.elevationLowest = this.elevationStart;

		for (const entry of this.points) {
			if (entry[2] > this.elevationHighest) {
				this.elevationHighest = entry[2];
			} else if (entry[2] < this.elevationLowest) {
				this.elevationLowest = entry[2];
			}
		}

		//If heartrate exists in the GPS trace log the highest and lowest values
		if (this.properties.heartRates !== undefined) {
			this.heartrateLowest = Infinity;
			this.heartrateHighest = 0;
			for (const entry of this.properties.heartRates) {
				if (entry > this.heartrateHighest) {
					this.heartrateHighest = entry;
				} else if (entry < this.heartrateLowest) {
					this.heartrateLowest = entry;
				}
			}
		}
	}

	//Returns true if heartrate values are found in the GPS trace
	hasHeartrates() {
		return this.properties.heartRates !== undefined
	}

	//Returns the highest found heartrate value
	getMaxHeartrate() {
		return this.heartrateHighest;
	}

	//Returns the lowest found heartrate value
	getMinHeartrate() {
		return this.heartrateLowest;
	}

	//Returns the name of the GPS trace
	getName() {
		return this.geoJSON.features[0].properties.name;
	}

	//Returns a date object of the time saved in the first recorded GPS log
	getStartTime() {
		return new Date(this.geoJSON.features[0].properties.coordTimes[0]);
	}

	//Returns a date object of the time saved in the last recorded GPS log
	getFinishTime() {
		const maxLength = this.geoJSON.features[0].properties.coordTimes.length;

		//Start at the end of the coordinates and loop backwards
		let lastDate
		for (let i = maxLength; i > 0; i--) {

			//Sometimes the last GeoJSON coordinate index doesn't have an associated coordinate 
			//time value so loop back through the coordinate times until we find a value
			if (!this.geoJSON.features[0].properties.coordTimes[i]) {
				continue;
			}

			lastDate = this.geoJSON.features[0].properties.coordTimes[i];
			break;
		}

		return new Date(lastDate);
	}

	//Returns a date object of the total time the GPS tracker was recording
	getTotalTime() {

		//Subtract the starting time from the finishing time to get the time difference
		const totalTime = new Date(this.getFinishTime() - this.getStartTime());

		//Account for timezone offset (possible GMT-BST issues)
		totalTime.setTime(totalTime.getTime() + totalTime.getTimezoneOffset() * 60 * 1000);

		return totalTime;
	}

	//Returns the average speed of the runner in km/h units
	getSpeed() {

		const totalTime = this.getTotalTime();
		const distance = this.getLength();

		//Convert minutes and seconds into hours
		const time = (totalTime.getHours() + (totalTime.getMinutes() / 60) + (totalTime.getSeconds() / 60 / 60));

		//Divide distance by time to get speed
		return (distance / time).toFixed(2); //km/hour
	}

	//Returns the average pace of the runner in min/km units
	getPace() {

		const totalTime = this.getTotalTime();
		const distance = this.getLength();

		//Convert hours and seconds into minutes
		const time = (totalTime.getHours() * 60) + totalTime.getMinutes() + (totalTime.getSeconds() / 60);

		//Divide time by distance to get pace (rounded to 5 decimal places)
		let pace = (time / distance).toFixed(5);

		//Split pace up into 2 parts - integer and decimal
		const intPart = parseFloat((pace + "").split(".")[0]);
		//Take the decimal part, account for decimal places and then convert to seconds format
		const decPart = parseFloat((pace + "").split(".")[1]) * 0.00001 * 0.6;

		//Rejoin both parts together
		pace = (intPart + decPart).toFixed(2);
		pace = pace.toString().replace(".", ":");

		return pace; //mins/km
	}

	//Returns the highest found altitude value
	getMaxElevation() {
		return this.elevationHighest;
	}

	//Returns the lowest found altitude value
	getMinElevation() {
		return this.elevationLowest;
	}

	//Returns the difference in the highest and lowest elevation values
	getNetElevationDiff() {
		return (this.elevationHighest - this.elevationLowest).toFixed(1);
	}

	//Returns the average heartrate in beats per minute
	getAverageHeartrate() {
		if (!this.hasHeartrates()) return 0;

		let total = 0;

		//Sum all heartrate values and divide by number of values
		for (let i = 0; i < this.properties.heartRates.length; i++) {
			total = total + this.properties.heartRates[i];
		}

		total = total / this.properties.heartRates.length;

		return Math.round(total)
	}

	//Returns the length of the track in km
	getLength() {
		return turfLength(this.geoJSON, {
			units: 'kilometers'
		})
	}

	//Returns the length of the track in miles
	getLengthMiles() {
		return turfLength(this.geoJSON, {
			units: 'miles'
		}).toFixed(2)
	}

	//Takes an array and a divider (n), splits the array into a given number of 'slices'
	//Each slice is an array which contains (array.length / n) values
	getSplits(toSplit, numSlices) {
		const points = [...toSplit]; //Copy array
		const splits = []; //Holds individual splits

		for (let i = numSlices; i > 0; i--) {
			splits.push(points.splice(0, Math.ceil(points.length / i)));
		}

		return splits;
	}

	//Returns all associated chart data for a track
	//Data values are averaged and grouped into smalled 'slices' from the section above
	//Charts load faster when only rendering 250 objects by default - rather than 2000+
	getChartData(numSlices = 250) {
		const splits = this.getSplits(this.points, numSlices);
		const result = [];

		let currentIndex = 0;
		let totalDistance = 0;

		let startTime = new Date(this.properties.coordTimes[0])
		startTime.setTime(startTime.getTime() + startTime.getTimezoneOffset() * 60 * 1000);

		//Loop through splits
		for (let i = 0; i < splits.length; i++) {

			//Assign current split
			const currentSplit = splits[i];

			let heartrateTotal = 0;
			let altitudeTotal = 0;
			let averageDistance = 0;
			let averageTime = 0;
			let timeStamp;

			//Loop points in current split
			for (let x = 0; x < currentSplit.length; x++) {
				if (this.hasHeartrates()) {
					heartrateTotal += this.properties.heartRates[currentIndex + x];
				}

				//Speed and pace can be calculated because we have 2 points
				if (this.properties.coordTimes[currentIndex + x - 1]) {

					//Get indexes relative to the main GeoJSON object
					let prevLatLngIndex = currentIndex + x - 1;
					let curLatLngIndex = currentIndex + x;

					//Calculate time spent between points
					let prevTime = new Date(this.properties.coordTimes[prevLatLngIndex]);
					let curTime = new Date(this.properties.coordTimes[curLatLngIndex]);

					let timeDiff = new Date(curTime - prevTime);

					//Account for timezone difference (GMT-BST issues)
					timeDiff.setTime(timeDiff.getTime() + timeDiff.getTimezoneOffset() * 60 * 1000);

					timeStamp = new Date(curTime - startTime);
					timeStamp.setHours(timeStamp.getHours() - 1)

					//Convert to minutes
					timeDiff = (timeDiff.getHours() * 60) + timeDiff.getMinutes() + (timeDiff.getSeconds() / 60) + (timeDiff.getMilliseconds() / 60 / 60);

					//Get the distance between the 2 points
					let distance = turfDistance(turfPoint(this.points[curLatLngIndex]), turfPoint(this.points[prevLatLngIndex]))
					totalDistance = totalDistance + distance
					averageDistance = averageDistance + distance;

					averageTime = averageTime + timeDiff;
				}

				//Add to the total altitude
				altitudeTotal += currentSplit[x][2];
			}

			//Calculate speed and pace
			let pace = (averageTime / averageDistance).toFixed(5);
			let speed = (averageDistance / averageTime * 60).toFixed(3);

			if (speed === "Infinity" || pace > 130) {
				currentIndex = currentIndex + currentSplit.length
				continue;
			}

			const intPart = parseFloat((pace + "").split(".")[0]);
			const decPart = parseFloat((pace + "").split(".")[1]) * 0.00001 * 0.6;

			let pacePart = (intPart + decPart).toFixed(2);
			pacePart = pacePart.toString().replace(".", ":");

			//Calculate average values for heartrate and altitude
			heartrateTotal = heartrateTotal / currentSplit.length;
			heartrateTotal = Math.round((heartrateTotal + Number.EPSILON) * 100) / 100

			altitudeTotal = altitudeTotal / currentSplit.length;

			let toPush = {
				heartrate: heartrateTotal,
				altitude: altitudeTotal,
				speed: speed,
				paceWhole: pace,
				pace: pacePart,
				distance: totalDistance,
				time: timeStamp,
			}

			result.push(toPush);

			currentIndex = currentIndex + currentSplit.length
		}

		return result;
	}
}

module.exports.TrackInfo = TrackInfo;