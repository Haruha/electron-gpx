//Helper function to generate HTML for a Bootstrap toast
function createAlert(bodyText, color = "#5FB3B3", delay = 4500) {
    //Template literal holds HTML to be added to the alert wrapper
    //Function parameters are added in as embedded expressions
    let alert = `
    <div class="toast ml-auto" role="alert" data-delay="${delay}" 
    data-autohide="true" style="pointer-events: auto;">
        <div class="toast-header bg-dark-primary">
            <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                <rect width="100%" height="100%" fill="${color}"></rect>
            </svg>
            <strong class="mr-auto text-darkened">Alert</strong>
            <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">×</span>
            </button>
        </div>
        <div class="toast-body">
            ${bodyText}
        </div>
    </div>`;

    //Append the alert to the alert wrapper
    $("#alertInner").append(alert);

    //Activate and show it
    $('#alertInner .toast:last').toast('show');
}

module.exports = {
    createAlert: createAlert,
}