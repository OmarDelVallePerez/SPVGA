let PDFJS = window['pdfjs-dist/build/pdf']; // Loaded via <script> tag, create shortcut to access PDF.js exports.
PDFJS.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js'; // The workerSrc property shall be specified.

function Pdf2TextClass(){
	let self = this;
	this.spliter = "|"
	this.complete = 0;

	/**
	 * @param data ArrayBuffer of the pdf file content
	 * @param callbackPageDone To inform the progress each time when a page is finished. The callback function's input parameters are:
	 *        1) number of pages done;
	 *        2) total number of pages in file.
	 * @param callbackAllDone The input parameter of callback function is the result of extracted text from pdf file.
	 */
	this.pdfToText = function(data, callbackPageDone, callbackAllDone){
		console.assert( data  instanceof ArrayBuffer  || typeof data == 'string' );
		PDFJS.getDocument( data ).promise.then( function(pdf) {
			//let div = document.getElementById('viewer');

			let total = pdf.numPages;
			callbackPageDone( 0, total );
			let layers = {};
			for (let i = 1; i <= total; i++){
				pdf.getPage(i).then( function(page){
					let n = page.pageNumber;
					page.getTextContent().then( function(textContent){
						if( null != textContent.items ){
							let page_text = "";
							let last_block = null;
							let sequences = 0;
							for( let k = 0; k < textContent.items.length; k++ ){
								let block = textContent.items[k];
								if (block.str==="X" ||  block.str==="X // X") {
									sequences = 0
									continue
								}
								//console.log(`[${sequences}] => _${block.str}_`)

								if (!block.str || block.str===" " && page_text.at(-1)!==self.spliter) {
									page_text += self.spliter
									sequences = 0
									continue
								}
								else
									sequences++

								if (rgxTxt.test(page_text.at(-1)))
									page_text += " "

								page_text += block.str

								if (last_block && last_block.str === "Especialidad")
									page_text += self.spliter

								last_block = block

								if (sequences===2 && page_text.at(-1)!==self.spliter) {
									page_text += self.spliter
									sequences = 0;
								}
							}

							//console.log("page " + n + " finished."); //" content: \n" + page_text);
							layers[n] =  page_text + "\n\n";
						}
						++ self.complete;
						callbackPageDone( self.complete, total );
						if (self.complete === total){
							window.setTimeout(function(){
								let full_text = "";
								let num_pages = Object.keys(layers).length;
								for( let j = 1; j <= num_pages; j++)
									full_text += layers[j] ;
								callbackAllDone(full_text, num_pages);
							}, 1000);
						}
					}); // end  of page.getTextContent().then
				}); // end of page.then
			} // of for
		});
	}; // end of pdfToText()
} // end of class