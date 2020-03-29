// --------------------------------------------------------------------------------------------------------------------
// Get the current call stack.
//
// Based on code from http://stackoverflow.com/a/13227808
//
// @module util/stack
// --------------------------------------------------------------------------------------------------------------------

// Regular expression to match any module in this package
var fileInThisPkgRE = /\/omega-logger\/(lib\/|util\/)?\w+.js/;

// --------------------------------------------------------------------------------------------------------------------

//Stack.prototype.toString = function(indent)
function Stack__toString(indent)
{
    indent = indent || '    ';
    return indent + this.join('\n' + indent);
} // end Stack__toString

// --------------------------------------------------------------------------------------------------------------------

function getStack()
{
    // Save original Error.prepareStackTrace.
    var origPrepareStackTrace = Error.prepareStackTrace;

    try
    {
        // Override with function that just returns `stack`.
        Error.prepareStackTrace = function(_, stack)
        {
            return stack;
        };

        // Create a new `Error`, generating a stack trace.
        var err = new Error();

        // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`.
        var stack = err.stack;

        // Ignore any initial frames that fall within this package, returning the rest.
        var framesToSkip = 0;
        for(var idx = 0; idx < stack.length; idx++)
        {
            if(!fileInThisPkgRE.test(stack[idx]))
            {
                break;
            } // end if

            framesToSkip += 1;
        } // end for

        stack = stack.slice(framesToSkip);

        // Attach our toString() override.
        stack.toString = Stack__toString;

        return stack;
    }
    finally
    {
        // Restore original `Error.prepareStackTrace`.
        Error.prepareStackTrace = origPrepareStackTrace;
    } // end try
} // end getStack

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    getStack: getStack
};
