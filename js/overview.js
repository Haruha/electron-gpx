//Load inter-process communication module
const {
    ipcRenderer
} = require("electron");

//Get loaded linestypes
const lineTypes = require('./linestyles.js');

//jQuery listeners for overview dropdown menus
//Linestyle dropdown open
$("#highlight-dropdown").on("show.bs.dropdown", function (event) {
    let markup = "";
    markup += '<h6 class="dropdown-header">Line style</h6>';

    //When the line styles dropdown is clicked, load all line styles as list items
    for (let i = 0; i < lineTypes.length; i++) {
        markup += '<a class="dropdown-item" href="#">' + lineTypes[i].name + '</a>';
    }

    $("#highlight-dropdown-menu").html(markup);
});

//Linestyle dropdown select
$('#highlight-dropdown').on('hide.bs.dropdown', function (event) {
    if (!event.clickEvent) return;
    if (!event.clickEvent.target) return;
    if (event.clickEvent.target.className !== "dropdown-item") return;
    //A valid item has been selected

    //Send selected linestyle to main process to update on map
    ipcRenderer.send('sendStyle', event.clickEvent.target.innerText)
});

//Track downdown open
$("#track-dropdown").on("show.bs.dropdown", function (event) {

    //Request currently loaded tracks
    ipcRenderer.send('requestTracks');
    $("#track-dropdown-menu").html('<h6 class="dropdown-header">Selected track</h6>');
});

//Track dropdown select
$('#track-dropdown').on('hide.bs.dropdown', function (event) {
    if (!event.clickEvent) return;
    if (!event.clickEvent.target) return;
    if (event.clickEvent.target.className !== "dropdown-item") return;
    //A valid item has been selected

    //Trigger the onClick function for the track's legend - zooming to the track on the map
    if (document.getElementById("legend-" + event.clickEvent.target.innerText)) {
        document.getElementById("legend-" + event.clickEvent.target.innerText).click();
    }

    //Update the new active track
    ipcRenderer.send('activeTrack', event.clickEvent.target.innerText)
    //Request fresh tracks set from main
    ipcRenderer.send('requestTracks');
});

//Course dropdown open
$("#course-dropdown").on("show.bs.dropdown", function (event) {

    //Request currently loaded courses
    ipcRenderer.send('requestCourses');
    $("#course-dropdown-menu").html('<h6 class="dropdown-header">Selected course</h6>');
});


//Course dropdown select
$('#course-dropdown').on('hide.bs.dropdown', function (event) {
    if (!event.clickEvent) return;
    if (!event.clickEvent.target) return;
    if (event.clickEvent.target.className !== "dropdown-item") return;
    //A valid item has been selected

    //Update the new active course
    ipcRenderer.send('activeCourse', event.clickEvent.target.innerText)
    //Request fresh courses set from main
    ipcRenderer.send('requestCourses');
});

//Main process has returned the list of loaded tracks
ipcRenderer.on('returnTracks', (event, arg) => {
    let markup = "";

    //No tracks are loaded
    if (!arg[0]) {
        markup += '<h6 class="dropdown-header">No tracks loaded</h6>';
        $("#track-dropdown-menu").html(markup);
        return;
    }

    //arg[1] is the current active track which we don't need so simplify variable
    arg = arg[0];

    //Set HTML
    markup += '<h6 class="dropdown-header">Selected track</h6>';
    for (let i = 0; i < arg.length; i++) {
        let name = arg[i].features[0].properties.name
        markup += '<a class="dropdown-item" href="#">' + name + '</a>';
    }

    $("#track-dropdown-menu").html(markup);
});

//Main process has returned the list of loaded courses
ipcRenderer.on('returnCourses', (event, arg) => {
    let markup = "";

    //No courses are loaded
    if (!arg[0]) {
        markup += '<h6 class="dropdown-header">No courses loaded</h6>';
        $("#course-dropdown-menu").html(markup);
        return;
    }

    //arg[1] is the current active course which we don't need to simplify variable
    arg = arg[0];

    //Set HTML
    markup += '<h6 class="dropdown-header">Selected course</h6>';
    for (let i = 0; i < arg.length; i++) {
        let name = arg[i].properties.name
        markup += '<a class="dropdown-item" href="#">' + name + '</a>';
    }

    $("#course-dropdown-menu").html(markup);
});