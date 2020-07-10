//Edited version of Electron docs menu example used to include GPX loading options
//https://www.electronjs.org/docs/api/menu

const {
    app,
    Menu
} = require('electron').remote

//Load function exports from mapfuncs file
const {
    pickGpxFile,
    pickGpxFolder,
    pickGpxCourse
} = require("./mapfuncs")

const isMac = process.platform === 'darwin'

const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
        label: app.name,
        submenu: [{
                role: 'about'
            },
            {
                type: 'separator'
            },
            {
                role: 'services'
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit'
            }
        ]
    }] : []),
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [{
                label: 'Load course file',
                //Course file loading
                click: async () => {
                    pickGpxCourse();
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Load runner file',
                //Track file loading
                click: async () => {
                    pickGpxFile();
                }
            },
            {
                label: 'Load runner folder',
                //Multiple track loading
                click: async () => {
                    pickGpxFolder();
                }
            },
            {
                type: 'separator'
            },

            isMac ? {
                role: 'close'
            } : {
                role: 'quit'
            }

        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [{
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            },
            {
                role: 'copy'
            },
            {
                role: 'paste'
            },
            ...(isMac ? [{
                    role: 'pasteAndMatchStyle'
                },
                {
                    role: 'delete'
                },
                {
                    role: 'selectAll'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Speech',
                    submenu: [{
                            role: 'startspeaking'
                        },
                        {
                            role: 'stopspeaking'
                        }
                    ]
                }
            ] : [{
                    role: 'delete'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'selectAll'
                }
            ])
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [{
                role: 'reload'
            },
            {
                role: 'forcereload'
            },
            {
                role: 'toggledevtools'
            },
            {
                type: 'separator'
            },
            {
                role: 'resetzoom'
            },
            {
                role: 'zoomin'
            },
            {
                role: 'zoomout'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [{
                role: 'minimize'
            },
            {
                role: 'zoom'
            },
            ...(isMac ? [{
                    type: 'separator'
                },
                {
                    role: 'front'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'window'
                }
            ] : [{
                role: 'close'
            }])
        ]
    },
    {
        role: 'help',
        submenu: [{
            label: 'Learn More',
            click: async () => {

                const {
                    shell
                } = require('electron')

                await shell.openExternal('https://electronjs.org')
            }
        }]
    }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)