var excel = require('excel4node');


var workbook = new excel.Workbook();
var worksheet;


/**
 *  give the name of the sheet
 * @param name sheet name
 */
function sheet(name) {
    worksheet = workbook.addWorksheet(name);
    return this;
}


/**
 * * Set the header of the excel sheet
 * @param head array of strings that represents the header
 * @param style the style object
 * @returns {this}
 */
function header(head, style) {
    if (!head) return this;

    style = style ? style : {};
    for (var i = 0; i < head.length; i++) worksheet.cell(1, i + 1).string(head[i]).style(style);
    return this;
}

/**
 * set the content(body) of the excel sheet
 * @param content array of json objects
 * @param style the style object
 * @returns {this}
 */
function content(content, style) {
    if (!content) return this;

    if (!(typeof(content) === 'object'))
        try {
            content = JSON.parse(content);
        } catch (e) {
            throw ({message: "content should not be null", status: 400});
        }

    style = style ? style : {};
    //iterate first in the rows
    for (var i = 0; i < content.length; i++) {
        var json = Object.keys(content[i]);
        //iterate in the columns
        for (var j = 0; j < json.length; j++) {
            //console.log(content[i][json[j]] + "typeof " + typeof content[i][json[j]]);
            var val = content[i][json[j]] ? content[i][json[j]] : "";
            if (val instanceof Date)
                worksheet.cell(i + 2, j + 1).date(val).style(style);
            else if (val instanceof Number) worksheet.cell(i + 2, j + 1).number(val).style(style);
            else worksheet.cell(i + 2, j + 1).string(val + "").style(style);
        }
    }

    return this;
}


/**
 * write excel on the http response
 * @param fileName name of the file that will be download
 * @param res http response object
 * @returns {this}
 */
function write(fileName, res) {
    workbook.write(fileName, res);
    return this;
}


var excelWriter = {
    sheet: sheet,
    header: header,
    content: content,
    write: write
};


/*var header = ["UUID", "Client", "Service", "Timestamp", "Tipo", "Notes"];
var result = [{
    "uuid": "uuid3",
    "client": "pier",
    "service": "servizio2",
    "timestamp": "2018-01-15T07:43:49.000Z",
    "tipo": "KO",
    "notes": null
},
    {
        "uuid": "uuid4",
        "client": "pier",
        "service": "servizio2",
        "timestamp": "2018-01-15T08:43:49.000Z",
        "tipo": "KO",
        "notes": null
    }];

var styles = {
    font: {
        color: '#000000',
        size: 12,
        bold: true
    },
    numberFormat: '$#,##0.00; ($#,##0.00); -'
};*/

/*write("excel/excel.xlsx")*/
/*var styleCreated = createStyle(styles);
console.log(excelWriter.sheet("events").header(header, styleCreated).content(result).write("excel/excel.xlsx"));*/


module.exports = excelWriter;