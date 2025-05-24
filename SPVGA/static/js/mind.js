const rgxTxt = /[0-9a-z]/i
const url = "/signup"
let now = new Date()
const periodBreaker = new Date(`${now.getFullYear()}-06-23 00:00:00`)
const currentPeriod = {
	year: now.getFullYear()+(now<periodBreaker?0:1),
	period: (now<periodBreaker?"2":"1")
}
let loader = document.querySelector('#loader')
let dialog =document.querySelector('#dialog')

async function signup(form) {
	form.disabled = true
	let name  = form.name.value.rmLateralSpace().rmTildes(),
		phone = form.phone.value.rmLateralSpace(),
		email = form.email.value.rmLateralSpace()


	decode(form.inscription.files[0])
		.then(inscription => {
			if (!name.toUpperCase().split(" ").every(aElem => inscription.student.name.split(" ").includes(aElem)))
				return Promise.reject({code: 417, name: "usr_dif_name"})
			now = new Date()
			if (parseInt(inscription.period.substr(0,4)) !== currentPeriod.year || inscription.period.substr(-1)!==currentPeriod.period)
				return Promise.reject({code: 410, name: "usr_outdate", currentPeriod: inscription.period})

			inscription.student.phone = phone
			inscription.student.email = email

			console.log(JSON.stringify(inscription, null, 4))

			// Opciones por defecto estan marcadas con un *
			return fetch(url, {
				method: 'PUT', // *GET, POST, PUT, DELETE, etc.
				mode: 'cors', // no-cors, *cors, same-origin
				cache: 'default', // *default, no-cache, reload, force-cache, only-if-cached
				credentials: 'same-origin', // include, *same-origin, omit
				headers: {
					'Content-Type': 'application/json'
					// 'Content-Type': 'application/x-www-form-urlencoded',
				},
				redirect: 'follow', // manual, *follow, error
				referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
				body: JSON.stringify(inscription) // body data type must match "Content-Type" header
			})
			.then(response => response.json())// parses JSON response into native JavaScript object
			.then(resJson => {
				if (resJson.code>=300)
					return Promise.reject(resJson)
				else {
					console.log("Recibiendo Success "+JSON.stringify(resJson,null,4))
	
					dialog.classList.remove('error')
					dialog.classList.add('success')
					dialog.querySelector('h1').innerText = '¡Registro concluido!'
					dialog.querySelector('p').innerText = (resJson.code === 201)
						? `Se ha agregado a ${resJson.grps_registered}/${resJson.total}\nVe a Whatsapp y revisa que grupos se han agregado correctamente.`
						: 'Ve a Whatsapp y revisa que todos los grupos se hayan agregado correctamente.'
				}
			})

		})
		.then( txt => {
			console.log("Result"+JSON.stringify(txt, null, 4))
		})
		.catch(err => {
			dialog.classList.remove('success')
			dialog.classList.add('error')
			dialog.querySelector('h1').innerText = '¡Vaya.. Algo salió mal!'
			switch (err.code) {
				case 404:	// usr_not_found
					dialog.querySelector('p').innerText = `Error: ${err.code} \nEl número no se encuentra registrado en Whatsapp `
					break
				case 406:	//	usr_already_registered
					dialog.querySelector('p').innerText = `Error: ${err.code} \nEl número ya se encuentra registrado en los grupos de cada asignatura.`
					break
				case 409:	//
					dialog.querySelector('p').innerText = `Error: ${err.code} \nEl archivo no corresponde a un archivo PDF de Comprobante de inscripción del IPN.`
					break
				case 410:	//
					dialog.querySelector('p').innerText = `Error: ${err.code} \nEl comprobante no corresponde al periodo en curso \n${currentPeriod.year}-${currentPeriod.period} \nEl comprobante corresponde al periodo ${err.currentPeriod}`
					break
				case 417:	//
					dialog.querySelector('p').innerText = `Error: ${err.code} \nEl comprobante no corresponde a ${name}. Por favor, utiliza un comprobante a tu nombre`
					break
				case 502: 	// db_failed_request
					dialog.querySelector('p').innerText = `Error: ${err.code} \nHubo con problema con la base de datos`
					break
				case 503:	// wa_failed_grp_creation
					dialog.querySelector('p').innerText = `Error: ${err.code} \nSe ha superado un límite de creacion de grupos. \n Por favor, intenta mañana`
					break
				default:
					console.error(err)
					dialog.querySelector('p').innerText = `Error: ${err.code} \n${err.name}`
			}
		})
		.finally(_ => {
			form.inscription.value = ''
			loader.classList.add('d-none')	// Quitar la pantalla de carga
			dialog.classList.remove('d-none')	// Muestra ventana de dialogo
		})
}

document.forms[0].onsubmit = ev => {
	ev.preventDefault();
	loader.classList.add('d-none')
	signup(ev.target)
		.then(_ => loader.classList.remove('d-none'))
}

document.forms[0].addEventListener('keyup', (ev) => {
	let form = ev.target.form
	let isNotEmpty = true
	let isNotFillingOptionalInp = true
	for (const formElement of form) {
		if (formElement.type !== "file" && formElement.name && formElement.required)
			if (!formElement.value)
				isNotEmpty = false;
		if (formElement === document.activeElement && !formElement.required)
			isNotFillingOptionalInp = false
	}

	form.inscription.disabled = !form.checkValidity()

	if (!form.checkValidity() && isNotEmpty && isNotFillingOptionalInp)
		form.reportValidity()
})

document.querySelector('#close-dlg').addEventListener('click', ev => {
	dialog.classList.add('d-none')	// Oculta ventana de dialogo
})

document.querySelector("[type='file']").addEventListener('change', ev =>
	document.querySelector('#btnSubmit').click()
);

/**
 * @returns {String} same string without beginning and ending spaces [\s]
 */
String.prototype.rmLateralSpace = function () {
	return this.replace(/\s+$/, '').replace(/^\s+/, '')
}

/**
 * @returns {String} same string without tildes excluding ~
 */
String.prototype.rmTildes = function () {
	return this.normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "");
}

/**
 * @param file {File} PDF file to decode
 * @returns {Promise<JSON>} Inscription structure which contains student, institute, school, career, major, period and classes
 */
const decode = (file) => new Promise((resolve, reject) => {

	if (file.name.toLowerCase().match(/\w+$/)[0] !== 'pdf')
		reject({code:409, name: 'usr_not_file'})
	else {
		let reader = new FileReader();
		reader.onload = function() {
			let arrayBuffer = this.result
			let inscriptionData = {student: {}, class: []}

			new Pdf2TextClass().pdfToText(arrayBuffer, ()=>{}, (text) => {
				let data = text
					.split(new Pdf2TextClass().spliter) // Splits using the Inscription Decoder's spliter
					.map(elem => elem.rmLateralSpace())	// Trims beginning and ending space
					.filter(elem => elem)			    // Removes any empty field

				if (data[0] !== "INSTITUTO POLITECNICO NACIONAL")
					reject({code:409, name: 'usr_not_file'})
				else {
					inscriptionData.institute = data.shift()
					inscriptionData.school = data.shift()
					while (data.shift() !== "Nombre:") {}
					inscriptionData.student.id = data.shift()
					while (data.shift() !== "Licenciatura:") {}
					inscriptionData.career = data.shift()
					while (data.shift() !== "Especialidad") {}
					inscriptionData.major = data.shift()
					inscriptionData.student.name = data.shift()
					while (data.shift() !== "Salón") { }

					for (let isValidField = true, i=0; isValidField; i++) {
						let classGroup	= data.shift(),
							className	 = data.shift(),
							classTeacher	= data.shift(),
							classSchedule = "",
							isSchedule	= true,
							tmp

						while (isSchedule) {
							tmp = data[0]
							isSchedule = /^[\d]{2}:[\d]{2} -[\d]{2}:[\d]{2}/.test(tmp)//=>XX:XX -XX:XX
							isGroup = /^\d{1,2}[A-Z]{1,2}\d{1,2}$/.test(tmp)
							isFullName = /^[A-Z ]+$/.test(tmp)
							if (isSchedule)
								classSchedule += data.shift()+(tmp.includes("//")?" ":"\n")
							else if (!isGroup && isFullName) {
								classTeacher += " "+data.shift()
								isSchedule = true
							}
						}

						inscriptionData.class[i] = {
							group: classGroup,
							name: className,
							teacher: classTeacher,
							schedule: classSchedule
						}

						tmp = data[0]
						isValidField = !/^[a-z]{2,3} - /i.test(tmp)
					}
					data.shift()
					let tmp = data.shift().replace(" Periodo:", "")
					inscriptionData.period = tmp.replace(/\d$/, "-"+tmp.at(-1))
				}
				resolve(inscriptionData)
			})
		}
		reader.readAsArrayBuffer(file);
	}
})