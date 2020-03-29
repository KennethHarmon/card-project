// --------------------------------------------------------------------------------------------------------------------
// The console log handler.
//
// @module lib/handlers/console
// --------------------------------------------------------------------------------------------------------------------

var util = require('util');

var strFormat = require('../../util/strformat').format;

var BaseHandler = require('./base').BaseHandler;

// --------------------------------------------------------------------------------------------------------------------

function ConsoleHandler(/*config*/)
{
    BaseHandler.apply(this, arguments);
} // end ConsoleHandler

util.inherits(ConsoleHandler, BaseHandler);

// --------------------------------------------------------------------------------------------------------------------

// Default settings
ConsoleHandler.prototype.level = 'INFO';
ConsoleHandler.prototype.levelColors = {
    TRACE: '1;30',
    DEBUG: '37',
    INFO: '32',
    WARN: '33',
    ERROR: '31',
    CRITICAL: '1;31'
};

ConsoleHandler.prototype.dumperArgs = {
    colors: true
};

// Set the default console log handler's level according to the environment.
if(process.env.DEBUG && ['no', 'off', 'false', '0'].indexOf(process.env.DEBUG.toLowerCase()) == -1)
{
    ConsoleHandler.prototype.format = '\033[90m{shortDatetime} <\033[1;30m{filename}\033[0;90m:\033[1;30m{line}\033[0;90m:\033[1;30m{column}\033[0;90m> \033[1;30m[\033[{levelColor}m{level}\033[1;30m]\033[0;1m {logger}:\033[m {message}';
}
else
{
    ConsoleHandler.prototype.format = '\033[90m{shortDatetime} \033[1;30m[\033[{levelColor}m{level}\033[1;30m]\033[0;1m {logger}:\033[m {message}';
} // end if

// --------------------------------------------------------------------------------------------------------------------

ConsoleHandler.prototype.onMessage = function onMessage(context)
{
    context.levelColor = this.levelColors[context.level];

    console.log(strFormat(this.format, context));
}; // end onMessage

// --------------------------------------------------------------------------------------------------------------------

require('../../logging').handlers.console = ConsoleHandler;

module.exports = {
    ConsoleHandler: ConsoleHandler
};
