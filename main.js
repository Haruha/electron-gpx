// Modules to control application life and create native browser window
const {
	app,
	BrowserWindow,
	screen,
	ipcMain
} = require('electron')
const path = require('path')

app.allowRendererProcessReuse = true;



function createWindow() {
	//Create the browser window.
	let mainScreen = screen.getPrimaryDisplay();
	let dimensions = mainScreen.size;

	//Set up globals
	global.savedTracks = [];
	global.savedCourses = [];
	global.closestPoints = [];

	global.lineStyle = "Altitude";
	global.activeCourse = "";

	const mainWindow = new BrowserWindow({
		width: dimensions.width,
		height: dimensions.height,
		
		webPreferences: {
			nodeIntegration: true
		},
		backgroundColor: "#FFFFFF"
	})

	mainWindow.maximize();

	mainWindow.loadFile('index.html')
	
	mainWindow.webContents.once('did-finish-load', () => {
		mainWindow.webContents.send('dom-ready-check', {});
	});

	ipcMain.on('sendTrack', (event, arg) => {
		global.savedTracks.push(arg);
	});

	ipcMain.on('sendCourse', (event, arg) => {
		global.savedCourses.push(arg);
		global.activeCourse = arg;
	});

	ipcMain.on('removeTrack', (event, arg) => {
		for (let i = 0; i < global.savedTracks.length; i++) {
			if (arg === global.savedTracks[i].features[0].properties.name){
				global.savedTracks.splice(i, 1);
			}
		}

		global.activeTrack = global.savedTracks[0];
		event.sender.send('returnTracks', [global.savedTracks, global.activeTrack])
	});

	ipcMain.on('requestTracks', (event, arg) => {
		event.sender.send('returnTracks', [global.savedTracks, global.activeTrack])
	});
	
	ipcMain.on('activeTrack', (event, arg) => {
		global.activeTrack = arg;
		event.reply('replyActiveTrack', arg)
	})

	ipcMain.on('requestCourses', (event, arg) => {
		event.sender.send('returnCourses', [global.savedCourses, global.activeCourse])
	});

	ipcMain.on('activeCourse', (event, arg) => {
		global.activeCourse = arg;
		event.reply('replyActiveCourse', arg)
	})

	ipcMain.on('sendStyle', (event, arg) => {
		global.lineStyle = arg;
		event.reply('replyStyle', arg)
	})	

	ipcMain.on('sendClosestPoints', (event, arg) => {
		global.closestPoints = arg;
	})

	ipcMain.on('requestClosestPoints', (event, arg) => {
		event.reply('replyClosestPoints', (global.closestPoints))
	})

	mainWindow.webContents.on('new-window', function (event) {
		event.preventDefault()
	})
}

//This method will be called when Electron has finished
//initialization and is ready to create browser windows.
//Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)

//Quit when all windows are closed.
app.on('window-all-closed', function () {
	//On macOS it is common for applications and their menu bar
	//to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
	//On macOS it's common to re-create a window in the app when the
	//dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) createWindow()
})