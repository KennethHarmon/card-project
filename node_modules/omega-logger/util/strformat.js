// --------------------------------------------------------------------------------------------------------------------
// Basic Python3-style String Formatting.
//
// @module util/strformat
// --------------------------------------------------------------------------------------------------------------------

var formatPattern = /\{([a-zA-Z0-9_]*)\}/g;

function format(formatString, context /*, positional args... */)
{
    var positional = Array.prototype.slice.call(arguments, 2);

    function formatReplacement(matched, varname)
    {
        if(varname)
        {
            return context[varname];
        }
        else
        {
            return positional.shift();
        } // end if
    } // end formatReplacement

    return formatString.replace(formatPattern, formatReplacement);
} // end format

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    format: format
};
