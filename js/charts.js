//Load Chart.js
const {
    Chart
} = require("chart.js");

//Load Chart.js annotations plugin
require("chartjs-plugin-annotation")


//Load Electron inter-process communication module
const {
    ipcRenderer
} = require("electron");

//Load Chart.js annotations plugin
require("chartjs-plugin-annotation")

//Load TrackInfo class
const TrackInfo = require('./trackinfo').TrackInfo;

//Global config
Chart.defaults.global.defaultFontFamily = "MainFontFamily";


//Main ChartManager class
class ChartManager {
    constructor() {
        //Hold all loaded chart objects
        this.loadedCharts = [];
    }

    //Responsible for initialising a new chart
    createChart(context, data, name, xlabel, ylabel, reverse = false) {

        //Initialise chart fill gradient
        let gradient = context.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(66, 166, 198,0.6)');
        gradient.addColorStop(1, 'rgba(66, 166, 198,0.2)');

        //Create new chart object
        let chart = new Chart(context, {
            type: 'line',
            data: {
                datasets: [{
                    label: name,
                    data: data,
                    //Set the fill colour under the line to be the gradient fill initialised earlier
                    backgroundColor: gradient,
                    borderColor: [
                        'rgba(66, 166, 198, 1)',
                    ],
                    pointRadius: 0,
                    fill: "start"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                //Tooltips
                tooltips: {
                    intersect: false,
                    mode: 'index',
                    callbacks: {

                        //Tooltip callback override to display distance as title
                        title: function (tooltipItem, data) {
                            tooltipItem = tooltipItem[0]

                            //Make sure tooltip is within bounds of chart elements
                            let index = tooltipItem.index - 1
                            if (tooltipItem.index < 1) index = 1;
                            if (tooltipItem.index >= data.allData.length) index = data.allData.length - 1;

                            return "Distance " + data.allData[index].distance.toFixed(2) + "km";
                        },

                        //Label callback override to display other data labels in tooltip
                        label: function (tooltipItem, data) {

                            //Make sure tooltip is within bounds of chart elements
                            let index = tooltipItem.index - 1
                            if (tooltipItem.index < 1) index = 1;
                            if (tooltipItem.index >= data.allData.length) index = data.allData.length - 1;

                            //Time string
                            let timeString = data.allData[index].time

                            let minutes = timeString.getMinutes()
                            if (minutes < 10) minutes = "0" + minutes;

                            let seconds = timeString.getSeconds()
                            if (seconds < 10) seconds = "0" + seconds;
                            timeString = timeString.getHours() + ":" + minutes + ":" + seconds

                            //Speed string
                            let speed = parseFloat(data.allData[index].speed).toFixed(2)

                            return [
                                "Time " + timeString,
                                "Pace " + data.allData[index].pace + "/km",
                                "Altitude " + data.allData[index].altitude.toFixed(1) + "m",
                                "Heartrate " + data.allData[index].heartrate.toFixed(0) + "bpm",
                                "Speed " + speed + "km/h"
                            ];
                        }
                    }
                },
                scales: {
                    yAxes: [{
                        //Depending on what chart is loading change whether or not axis starts at 0
                        ticks: {
                            beginAtZero: reverse,
                            reverse: reverse,
                        },
                        scaleLabel: {
                            display: true,
                            labelString: xlabel
                        }
                    }],
                    xAxes: [{
                        type: 'linear',
                        position: 'bottom',
                        scaleLabel: {
                            display: true,
                            labelString: ylabel
                        },
                    }]
                },
                elements: {
                    line: {
                        //Disable bezier curves
                        //Improves speed and makes points more readable
                        tension: 0.1
                    }
                },

            }
        });

        //Save chart to loaded charts
        this.loadedCharts.push({
            name: name,
            chart: chart
        })
    }

    //Update chart with a new dataset
    addData(chart, label, data) {

        //Add chart header
        chart.data.labels.push(label);

        //Add dataset
        chart.data.datasets.forEach((dataset) => {
            dataset.data = data;
        });

        //Add axis labels
        let yLabel = chart.options.scales.xAxes[0].scaleLabel.labelString;
        let xLabel = chart.options.scales.yAxes[0].scaleLabel.labelString

        //Add reverse condition
        let reverse = chart.options.scales.yAxes[0].ticks.reverse

        //Update scale options 
        chart.options.scales = {
            yAxes: [{
                ticks: {
                    beginAtZero: reverse,
                    reverse: reverse,
                },
                scaleLabel: {
                    display: true,
                    labelString: xLabel
                }
            }],
            xAxes: [{
                type: 'linear',
                position: 'bottom',
                scaleLabel: {
                    display: true,
                    labelString: yLabel
                },
                gridLines: {
                    display: false
                },
                ticks: {
                    min: 0,
                    max: data[data.length - 1].x,
                    callback: function (value, index, values) {
                        return Number(value.toFixed(2)) + "";
                    }
                }
            }]
        };

        //Update the chart with new options
        chart.update();
    }

    //Remove current data and labels from chart
    removeData(chart) {
        chart.data.labels.pop();
        chart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        chart.update();
    }
}

let chartManager = new ChartManager();

//Create 4 charts
chartManager.createChart(document.getElementById('chart-heartrate').getContext('2d'), [], "Heartrate", "Heartrate (bpm)", "Distance (km)")
chartManager.createChart(document.getElementById('chart-altitude').getContext('2d'), [], "Altitude", "Elevation (m)", "Distance (km)")
chartManager.createChart(document.getElementById('chart-speed').getContext('2d'), [], "Speed", "Speed (km/h)", "Distance (km)")
chartManager.createChart(document.getElementById('chart-pace').getContext('2d'), [], "Pace", "Pace (mins/km)", "Distance (km)", true)

//Request track array when charts tab is loaded
$('a[data-toggle="pill"]').on('shown.bs.tab', function (e) {
    if ($(e.target).attr("href") === '#profile-v') {
        ipcRenderer.send('requestTracks', "")
    }
})

//Receiving track data
ipcRenderer.on('returnTracks', (event, arg) => {
    //All tracks have been removed
    if (arg[0].length === 0) return;

    let track;
    //Get current track by name
    for (let i = 0; i < arg[0].length; i++) {
        if (arg[1] === arg[0][i].features[0].properties.name) {
            track = arg[0][i];
        }
    }

    for (let i = 0; i < chartManager.loadedCharts.length; i++) {
        let currentLabel = chartManager.loadedCharts[i].name;

        //Remove all data from the chart
        chartManager.removeData(chartManager.loadedCharts[i].chart);

        if (!track) return;

        let newRates = [];
        let data = [];

        //Get track information for loaded track
        let trackInfo = new TrackInfo(track);

        //Get formatted chart information
        let allData = trackInfo.getChartData();

        //Save as meta so it can be accessed when creating tooltips and labels
        chartManager.loadedCharts[i].chart.data.allData = allData;

        //Decide which data to push to which chart based on name
        for (let x = 0; x < allData.length; x++) {
            if (allData[x].speed === "Infinity") {
                continue;
            }
            if (currentLabel === "Heartrate") {
                data.push(allData[x].heartrate)
            } else if (currentLabel === "Altitude") {
                data.push(allData[x].altitude)
            } else if (currentLabel === "Speed") {
                data.push(allData[x].speed)
            } else if (currentLabel === "Pace") {
                data.push(Number(allData[x].paceWhole))
            }
        }

        //Add dummy start value so chart begins at 0 and not 1
        newRates.push({
            x: 0,
            y: data[0]
        })

        //Load into new dataset
        for (let it = 0; it < data.length; it++) {
            newRates.push({
                x: allData[it].distance,
                y: data[it]
            })
        }

        //Push new data to the chart
        chartManager.addData(chartManager.loadedCharts[i].chart, currentLabel, newRates)
    }

    //If a course is loaded then request the closest points
    ipcRenderer.send('requestClosestPoints')
})

ipcRenderer.on('returnCourses', (event, arg) => {
    //Request closest points to course
    ipcRenderer.send('requestClosestPoints')
})

//Called when main process replies with array of clostest points between track and course
ipcRenderer.on('replyClosestPoints', (event, arg) => {

    //The track has been removed
    if (arg.length === 0) {
        //Clear loaded annotations on charts then return
        for (let i = 0; i < chartManager.loadedCharts.length; i++) {
            let chart = chartManager.loadedCharts[i].chart;
            chart.options.annotation = {}
        }
        return;
    }

    //Iterate through loaded charts
    for (let i = 0; i < chartManager.loadedCharts.length; i++) {
        let chart = chartManager.loadedCharts[i].chart;

        let annotations = []

        //Add an annotation (vertical line) where each control is based on distance
        for (let x = 0; x < arg.length; x++) {
            annotations.push({
                type: 'line',
                mode: 'vertical',
                scaleID: 'x-axis-0',
                drawTime: 'afterDatasetsDraw',
                value: arg[x].properties.location,
                borderColor: 'rgba(66, 166, 198, 1)',
                borderWidth: 1,
                label: {
                    backgroundColor: 'rgba(0,0,0,0)',
                    fontFamily: "MainFontFamily",
                    fontSize: 9,
                    fontStyle: "bold",
                    fontColor: "#5B758A",
                    position: "bottom",
                    xAdjust: -10,
                    yAdjust: -4,
                    enabled: true,
                    content: "#" + (x + 1),
                    rotation: 90
                },
            })
        }

        //Push annotations to chart object
        chart.options.annotation = {
            annotations: annotations
        }

        //Update chart object
        chart.update();
    }
})