// --------------------------------------------------------------------------------------------------------------------
// The base log handler.
//
// @module lib/handlers/base
// --------------------------------------------------------------------------------------------------------------------

var logging = require('../../logging');

// --------------------------------------------------------------------------------------------------------------------

function BaseHandler(config)
{
    config = config || {};

    for(var key in config)
    {
        if(config.hasOwnProperty(key))
        {
            this[key] = config[key];
        } // end if
    } // end for
} // end BaseHandler

// --------------------------------------------------------------------------------------------------------------------

// Default settings
BaseHandler.prototype._level = null;  // By default, log everything.
Object.defineProperty(BaseHandler.prototype, 'level', {
    'get': function getLevel()
    {
        return this._level;
    }, // end getLevel
    'set': function setLevel(value)
    {
        if(logging.getLevel)
        {
            this._level = logging.getLevel(value);
        }
        else
        {
            this._level = value;
        } // end if
    } // end setLevel
}); // end 'level' property

// --------------------------------------------------------------------------------------------------------------------

BaseHandler.prototype.log = function log(context)
{
    if(logging.levels.indexOf(context.level) >= logging.levels.indexOf(this.level))
    {
        this.onMessage(context.attachToHandler(this));
    } // end if
}; // end log

BaseHandler.prototype.lessVerbose = function()
{
    this.level = logging.nextLevelUp(this.level);
}; // end lessVerbose

BaseHandler.prototype.moreVerbose = function()
{
    this.level = logging.nextLevelDown(this.level);
}; // end moreVerbose

BaseHandler.prototype.adjustFromArgs = function(args)
{
    // Default to process.argv if no args were passed.
    args = args || process.argv;

    var netLevelAdjustment = args.reduce(function(accum, arg)
    {
        // Short flags ('-v' or '-q')
        if(/^-\w*[vq]\w*$/.test(arg))
        {
            // Check each flag; skip the first character. ('-')
            for(var idx = 1; idx < arg.length; idx++)
            {
                switch(arg[idx])
                {
                    case 'v':
                        accum += 1;
                        break;
                    case 'q':
                        accum -= 1;
                        break;
                } // end switch
            } // end for
        }
        // Long flags ('--verbose' or '--quiet')
        else if(arg == '--verbose')
        {
            accum += 1;
        }
        else if(arg == '--quiet')
        {
            accum -= 1;
        } // end if

        return accum;
    }, 0);

    // Adjust our minimum severity level.
    for(; netLevelAdjustment < 0; netLevelAdjustment++)
    {
        this.lessVerbose();
    } // end for
    for(; netLevelAdjustment > 0; netLevelAdjustment--)
    {
        this.moreVerbose();
    } // end for
}; // end adjustFromArgs

// --------------------------------------------------------------------------------------------------------------------

logging.handlers.base = BaseHandler;

module.exports = {
    BaseHandler: BaseHandler
};
