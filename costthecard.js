$(document).ready(function() {
	asyncmain();
});

const base_url = "https://api.scryfall.com/cards/search?";
const mana_cost_url = "https://api.scryfall.com/symbology/parse-mana?";
const base_query = "q=(-type%3Aconspiracy+-type%3Aland)+(-is%3Afunny+-is%3Asplit)";	// FULL QUERY
//const base_query = "q=(-type%3Aconspiracy+-type%3Aland)+(-is%3Afunny+-is%3Asplit)+is%3Adoublesided";	// test double-faced and invalid selections

var cards_per_page;
var total_cards;
var current_card;
var score = 0;
var possible_score = 0;

var ready_for_submission = false;
var amount_of_submissions;
var previous_wrong_submission_cost = null;

const common_medal_src = "sym_common.png";
const uncommon_medal_src = "sym_uncommon.png";
const rare_medal_src = "sym_rare.png";
const mythicrare_medal_src = "sym_mythicrare.png";
var medal_img;

const card_width = 488;
const card_height = 680;
const symbol_width = 30;		// better to overcompensate than under
const symbol_height = 50;		// better to overcompensate than under

// returns expected JSON, error JSON (if errors allowed), or null
async function getJSONFromURL(url, allow_errors) {
	//console.log("sent request");
	var response = await fetch(url);
	//console.log("response: " + response.statusText + " " + response.status);
	var data;
	if (response.status == 200) data = await response.json();
	else {
		console.log("Failed get proper response from URL");
		console.log("response: " + response.statusText + " " + response.status);
		if (allow_errors) {
			console.log("Attempting to parse/return JSON anyway...");
			data = await response.json();
		}
		else return null;
	}
	//console.log("json loaded");
	if (data) return data;
	else {
		console.log("Failed get JSON from response");
		console.log(response);
		return null;
	}
}

// fetches a new card, updates html elements, returns scryfall Card JSON object
// relies on cards_per_page and current_cards being set
async function getNewCard() {
	// hide the card canvas while preparing it
	$("#card_loading").show();
	$("#card_canvas").hide();
	$("#card_back_canvas").hide();
	
	// all indexing begins with 1, not 0
	amount_of_submissions = 0;
	ready_for_submission = false;
	var valid_card_found = false;
	var is_double_faced = false;
	while (!valid_card_found) {
		var next_card_absolute_index = Math.floor(Math.random() * total_cards) + 1;
		var next_card_page_index = Math.ceil(next_card_absolute_index / cards_per_page);
		var next_card_relative_index = next_card_absolute_index - ((next_card_page_index - 1) * cards_per_page);
		var next_url = "https://api.scryfall.com/cards/search?format=json&include_extras=false&include_multilingual=false&order=name&page="
			+ next_card_page_index + "&" + base_query;
		var next_scryfall_data = await getJSONFromURL(next_url, false);
		var next_card = next_scryfall_data.data[next_card_relative_index];
		
		// accept only no-mana-cost cards if they are double faced (manacost is in card_faces[0])
		if (next_card.mana_cost) {
			if (next_card.mana_cost == "") {
				console.log("Invalid card fetched, maybe a token or something, trying again...");
			}
			else {
				console.log("Found valid regular card");
				valid_card_found = true;
			}
		}
		else if (next_card.layout == "transform"){
			console.log("Found valid double-face card");
			next_card.mana_cost = next_card.card_faces[0].mana_cost;	// for simplifying later checks, dont need to accomodate double faced cards everywhere else
			valid_card_found = true;
			is_double_faced = true;
		}
		else {
			console.log("Invalid card fetched (likely a suspend card that was problematic to filter out), trying again...");
		}
		
	}
	console.log("index:(" + next_card_absolute_index + "/" + total_cards + ") on page:(" + next_card_page_index + "-" + next_card_relative_index + ")");
	console.log("check work: " + (((next_card_page_index - 1) * cards_per_page) + next_card_relative_index));
	
	$("#card_loading").hide();
	//var card_img = document.createElement("img");
	if (is_double_faced) {
		/*$("#card_img").attr("src", next_card.card_faces[0].image_uris.normal);
		$("#card_img_back").attr("src", next_card.card_faces[1].image_uris.normal);
		$("#card_img_back").show();*/
		$("#card_canvas").drawImage({
			source: next_card.card_faces[0].image_uris.normal,
			x: 0, y: 0, width: card_width, height: card_height,
			fromCenter: false
		});
		$("#card_back_canvas").drawImage({
			source: next_card.card_faces[1].image_uris.normal,
			x: 0, y: 0, width: card_width, height: card_height,
			fromCenter: false
		});
		$("#card_back_canvas").show();
	}
	else {
		/*$("#card_img").attr("src", next_card.image_uris.normal);
		$("#card_img_back").hide();*/
		$("#card_canvas").drawImage({
			source: next_card.image_uris.normal,
			x: 0, y: 0, width: card_width, height: card_height,
			fromCenter: false, load: coverCost
		});
		$("#card_back_canvas").hide();
	}	
	
	// cover the mana cost
	function coverCost() {
		// note: appears i cant get image data because the card image's source comes from an external server, thus origin-clean is false which throws an error on attempt to get image data
		// reference: https://stackoverflow.com/questions/17035106/context-getimagedata-operation-is-insecure
		//console.log($("#card_canvas").data());
		var symbols = countSymbols(next_card.mana_cost);
		//var ctx = $("#card_canvas").get(0).getContext("2d");
		var cover_x_offset = card_width - 35 - (symbols * symbol_width);
		var cover_y_offset = 30;
		//var ccid = ctx.getImageData(cover_x_offset, cover_y_offset, 1, 1);
		//var cover_color = "rgb(" + ccid.data[0] + "," + ccid.data[1] + "," + ccid.data[2] + ")";
		var cover_color = "rgb(155,155,155)";
		//console.log(cover_x_offset + " | " + cover_y_offset + " | " + symbols + " | " + cover_color)
		$("#card_canvas").drawRect({
			fillStyle: cover_color,
			x: cover_x_offset, y: cover_y_offset,
			width: (symbols * symbol_width), height: symbol_height,
			fromCenter: false
		});
		
		$("#card_canvas").show();
		current_card = next_card;
		ready_for_submission = true;
	}
}

function countSymbols(manacost_string) {
	var symbols = 0;
	for (let i = 0; i < manacost_string.length; i++) if (manacost_string[i] == '}') symbols++;
	return symbols;
}

$("#user_input_form").submit(async function() {
	// reject submission when no correct answer is available
	if (!ready_for_submission) {
		console.log("Attempted to submit answer, but not ready yet");
		return;
	}
	else if (!current_card) {
		console.log("Attempted to submit answer, but no card is set");
		return;
	}
	
	// clean the submission, ignore submission if invalid or blank
	ready_for_submission = false;
	console.log("submitted answer");
	if ($("#user_input").val() == "") {
		console.log("Blank submission ignored");
		ready_for_submission = true;
		return
	}
	var cleaned_mana_cost_data = await validateUserAnswer($("#user_input").val());
	if (cleaned_mana_cost_data == null) {
		console.log("Invalid submission ignored");
		ready_for_submission = true;
		return;
	}
	if (cleaned_mana_cost_data.cost == previous_wrong_submission_cost) {
		console.log("Duplicate submission ignored");
		ready_for_submission = true;
		return;
	}
	//console.log(cleaned_mana_cost_data);
	
	// determine if the submission is correct or incorrect
	var submission_is_correct = false;
	amount_of_submissions++;
	console.log($("#user_input").val() + " -> " + cleaned_mana_cost_data.cost);
	console.log("Answer is: " + current_card.mana_cost);
	
	// correct submission possibilities following:
	if (current_card.mana_cost == cleaned_mana_cost_data.cost && amount_of_submissions == 1) {
		submission_is_correct = true;
		console.log("4 points");
		score += 4;
		animateMedal(mythicrare_medal_src);
	}
	else if (current_card.cmc == cleaned_mana_cost_data.cmc && hasSameColors(current_card, cleaned_mana_cost_data) && amount_of_submissions == 1) {
		submission_is_correct = true;
		console.log("3 points");
		score += 3;
		animateMedal(rare_medal_src);
	}
	else if (current_card.cmc == cleaned_mana_cost_data.cmc && hasSameColors(current_card, cleaned_mana_cost_data) && amount_of_submissions == 2) {
		submission_is_correct = true;
		console.log("2 points");
		score += 2;
		animateMedal(uncommon_medal_src);
	}
	else if (current_card.cmc == cleaned_mana_cost_data.cmc && hasSameColors(current_card, cleaned_mana_cost_data) && amount_of_submissions == 3) {
		submission_is_correct = true;
		console.log("1 point");
		score += 1;
		animateMedal(common_medal_src);
	}
	
	// incorrect submission possibilities following:
	else if (amount_of_submissions == 3) {
		// this nextQuestion happens when the user is out of guesses
		console.log("Out of guesses, answer was " + current_card.mana_cost);
		//await getNewCard();
		$("#tries_span").html((2 - amount_of_submissions) + "/2");
		animateWrongAnswer();
		await getNewQuestion();
		//previous_wrong_submission_cost = null;
	}
	else if (!hasSameColors(current_card, cleaned_mana_cost_data)) {
		//console.log("colors are wrong, give color hint:");
		var color_hint = "Hint: Card's color(s): " + getColorString(current_card);
		//console.log(color_hint);
		$("#hint_span").html(color_hint);
		$("#tries_span").html((2 - amount_of_submissions) + "/2");
		animateWrongAnswer();
		previous_wrong_submission_cost = cleaned_mana_cost_data.cost;
		//for (let)
	}
	else if (current_card.cmc != cleaned_mana_cost_data.cmc) {
		//console.log("cmc is wrong, give cmc hint:");
		var cmc_hint = "Hint: The converted mana cost of the card is ";
		if (cleaned_mana_cost_data.cmc > current_card.cmc) cmc_hint += "less than " + cleaned_mana_cost_data.cmc;
		else cmc_hint += "greater than " + cleaned_mana_cost_data.cmc;
		//console.log(cmc_hint);
		$("#hint_span").html(cmc_hint);
		$("#tries_span").html((2 - amount_of_submissions) + "/2");
		animateWrongAnswer();
		previous_wrong_submission_cost = cleaned_mana_cost_data.cost;
		
	}
	else {
		console.log("incorrect, but not sure why, should never reach this point");
	}
	
	if (submission_is_correct) {
		// this nextQuestion happens on a correct submission
		console.log("correct");
		//$("#user_input").val("");
		//await getNewCard();
		await getNewQuestion();
		//previous_wrong_submission_cost = null;
	}
	else {
		// do this on every wrong answer
		//previous_wrong_submission_cost = cleaned_mana_cost_data.cost;
	}
	ready_for_submission = true;
});

// determine if the users answer submission was a valid answer (correct or incorrect regardless)
// takes the users sloppy input and gives back a scryfall mana_cost object if valid or null otherwise
async function validateUserAnswer(mana_cost) {
	var mana_cost_data = await getJSONFromURL(mana_cost_url + "cost=" + mana_cost, true);
	//console.log(mana_cost_data);
	//console.log(mana_cost_url + "cost=" + mana_cost);
	if (mana_cost_data.object != "error") return mana_cost_data;
	else {
		console.log("Invalid input submitted for validation");
		return null;
	}
}

async function showResults(points_earned) {
	$("#results_background").show();
	$("#results_container").show();
}

function hasSameColors(mana1, mana2) {
	// per the documentation, colors are limited to WUBRG chars, but are not in any particular order
	if (mana1.colors.length == mana2.colors.length) {
		var mana1bool = new Array(5).fill(false);
		for (let i = 0; i < mana1.colors.length; i++) {
			switch(mana1.colors[i]) {
				case 'W': mana1bool[0] = true;
					break;
				case 'U': mana1bool[1] = true;
					break;
				case 'B': mana1bool[2] = true;
					break;
				case 'R': mana1bool[3] = true;
					break;
				case 'G': mana1bool[4] = true;
					break;
			}
		}
		
		var mana2bool = new Array(5).fill(false);
		for (let i = 0; i < mana2.colors.length; i++) {
			switch(mana2.colors[i]) {
				case 'W': mana2bool[0] = true;
					break;
				case 'U': mana2bool[1] = true;
					break;
				case 'B': mana2bool[2] = true;
					break;
				case 'R': mana2bool[3] = true;
					break;
				case 'G': mana2bool[4] = true;
					break;
			}
		}
		
		for (let i = 0; i < mana1bool.length; i++) {
			if (mana1bool[i] != mana2bool[i]) return false;
		}
		return true
	}
	else return false;
}

function getColorString(mana) {
	// per the documentation, colors are limited to WUBRG chars, but are not in any particular order
	if (mana.colors.length == 0) return "Colorless";
	
	var manabool = new Array(5).fill(false);
	for (let i = 0; i < mana.colors.length; i++) {
		switch(mana.colors[i]) {
			case 'W': manabool[0] = true;
				break;
			case 'U': manabool[1] = true;
				break;
			case 'B': manabool[2] = true;
				break;
			case 'R': manabool[3] = true;
				break;
			case 'G': manabool[4] = true;
				break;
		}
	}
	
	var manastring = []
	if (manabool[0]) manastring.push("White");
	if (manabool[1]) manastring.push("Blue");
	if (manabool[2]) manastring.push("Black");
	if (manabool[3]) manastring.push("Red");
	if (manabool[4]) manastring.push("Green");
	
	//console.log(manastring.join(' '));
	return manastring.join(' ');
}

async function loadManaSymbols() {
	var container = document.getElementById("symbol_guide");
	var symbol_data = await getJSONFromURL("https://api.scryfall.com/symbology");
	var row = document.createElement("div");
	row.style.display = "flex";
	for (let i = 0; i < symbol_data.data.length; i++) {
		var symbol = symbol_data.data[i];
		if (symbol.appears_in_mana_costs && !symbol.funny) {
			var symbol_img = document.createElement("img");
			symbol_img.src = symbol.svg_uri;
			symbol_img.style.width = 15;
			symbol_img.id = symbol.symbol;
			symbol_img.addEventListener("click", function() {
				$("#user_input").val($("#user_input").val() + this.id);
				$("#user_input").focus();
				//console.log(this.id);
			});
			row.appendChild(symbol_img);
			//container.appendChild(symbol_img);
			if (symbol.symbol == "{W}" || symbol.symbol == "{U}" || symbol.symbol == "{B}" || symbol.symbol == "{R}" || symbol.symbol == "{G}")
				symbol_img.style.width = 30;
			if (symbol.symbol == "{16}" || symbol.symbol == "{2/G}" || symbol.symbol == "{G/P}"|| symbol.symbol == "{G}") {
				container.appendChild(row);
				row = document.createElement("div");
				row.style.display = "flex";
			}
		}
	}
	container.appendChild(row);
}

function setMedal() {
	//179x200
	medal_img = document.createElement("img");
	medal_img.style.width = 179;
	medal_img.style.position = "relative";
	medal_img.style.visibility = "hidden";
	$("#results_container").append(medal_img);
	
}

function animateMedal(src) {
	medal_img.src = src;
	medal_img.classList.remove("medal_anim");
	void medal_img.offsetWidth;
	medal_img.classList.add("medal_anim");
	
	/*document.getElementById("results_background").classList.remove("bg_fade_anim");
	void document.getElementById("results_background").offsetWidth;
	document.getElementById("results_background").classList.add("bg_fade_anim");*/
	
	$("#results_background").removeClass("bg_fade_anim");
	$("#results_background").width();
	$("#results_background").addClass("bg_fade_anim");
}

function animateWrongAnswer() {
	$("#tries_span").removeClass("wrong_answer_anim");
	$("#tries_span").width();
	$("#tries_span").addClass("wrong_answer_anim");
}

async function getNewQuestion() {
	$("#user_input").val("");
	previous_wrong_submission_cost = null;
	possible_score += 4;
	getNewCard();	// turns off submissions for duration
	$("#hint_span").html("");
	$("#tries_span").html("2/2");
	$("#score_span").html(score + "/" + possible_score);
	
}

function setCanvases() {
	/*$("#card_canvas").attr("width", card_width);
	$("#card_canvas").attr("height", card_height);
	$("#card_back_canvas").attr("width", card_width);
	$("#card_back_canvas").attr("height", card_height);*/
	
	$(".card_holding_canvas").attr("width", card_width);
	$(".card_holding_canvas").attr("height", card_height);
	//$("#card_canvas").hide();
	//$("#card_back_canvas").hide();
}

async function asyncmain() {
	//var scryfalldata = await getJSONFromURL("https://api.scryfall.com/cards/search?q=zegana"); // JSON scryfall list
	var base_scryfall_data = await getJSONFromURL(base_url + base_query, false); // JSON scryfall list
	cards_per_page = 174;
	total_cards = base_scryfall_data.total_cards;
	
	// debug
	//$("#results_background").hide();
	//$("#results_container").hide();
	
	setCanvases();				// as far as i can tell, these (non-style) attributes cant be set in css
	setMedal();
	await loadManaSymbols();
	getNewCard();
	
}

/*
-/filter acceptable cards and handle double faced
-/answer submission and validity checking
-/easy access button mana symbol shortcuts
-/score tracking
-/medal animation
-/start loading next card while animation is going (input should deny submissions while loading)

-img -> canvas w/ blocking
-/feedback on all guesses lost
-//feedback on invalid submission
-//feedback on duplicate submission

-yet to handle futureshifted frame (see Nix)

*/

/*
4 pts: perfect guess 1st try, cmc and pips
3 pts: 1st try, cmc right, colors right, (pips dont matter)
after first wrong guess, give one hint (below) colors -> cmc over-under
2 pts: 2nd try, cmc right, colors right, (pips dont matter)
after second wrong guess, give both hints (below) colors & cmc over-under
1 pts: 3rd try, cmc right, colors right, (pips dont matter)

accepted answer:
-matching cmc and colors

hint priority
-if colors are wrong, give colors
-else if cmc is wrong, hint higher/lower

cards to omit from initial search:
-cards without a manacost
	-lands
	-conspiracy
-silver border
	-funny
-split cards
	-split card
-tokens/art
	-TOKEN (tbd)
	-layout: art_series

additionally, reject cards that have:
-manacost = "" && !card_faces
	-suspend

if passed, check for:
-card_faces, set alt face img
*/

/*
instead of downloading every card, i could instead note the total number of cards (174) and
reference each page by its 174 cards (page1[1-174] page2[175-348])
https://api.scryfall.com/cards/search?format=json&include_extras=false&include_multilingual=false&order=name&page=2&q=cmc%3E%3D0+-type%3Aland+-set_type%3Afunny&unique=cards

UPDATED:
q=(-type%3Aconspiracy+-type%3Aland)+(-is%3Afunny+-is%3Asplit)
*/

//const loading_bar_width = 500;
//const loading_bar_height = 20;

/*var nonlands_request = new Request("https://api.scryfall.com/cards/search?q=cmc%3E%3D0+-type%3Aland");
//https://api.scryfall.com/cards/search?q=cmc%3E%3D0+-type%3Aland+-set_type%3Afunny doesnt use silver border
fetch(nonlands_request).then(function(response) {
	console.log(response.data);
});*/

/*var zegana_request = new Request("https://api.scryfall.com/cards/search?q=zegana");
fetch(zegana_request).then(function(response) {
	console.log(response.json());
});*/

/*var cardlist = [];
	var cards_retrieved = 0;
	var total_cards = scryfalldata.total_cards;
	while (1) {
		// add cards from current List to cardlist
		scryfalldata.data.forEach(function(card) {
			cardlist.push(card);
			cards_retrieved++;
			updateLoadingProgress(cards_retrieved, total_cards);
		});
		// if theres another List, get it
		if (scryfalldata.has_more) scryfalldata = await getJSONFromURL(scryfalldata.next_page);
		else {
			console.log("all cards loaded!");
			break;
		}
	}*/
	/*cardlist.forEach(function(card) {
		console.log("- " + card.name);
});*/

/*function getJSONFromURL(url) {
	var data;
	fetch(url)
	.then(function(response) {
		data = response.json();
		console.log(data);
		return data;
	});
	//var data = response.json();
	console.log("loaded data");
	
	//return data;
}*/

/*function updateLoadingProgress(num, den) {
	document.getElementById("loading_bar_inside").style.width = loading_bar_width * num / den;
}*/

/*$("#loading_bar_outside").width(loading_bar_width);
	$("#loading_bar_outside").height(loading_bar_height);
	$("#loading_bar_inside").width(0);
	$("#loading_bar_inside").height(loading_bar_height);*/
	
	// all indexing begins with 1, not 0
	/*var next_card_absolute_index = Math.floor(Math.random() * total_cards) + 1;
	var next_card_page_index = Math.ceil(next_card_absolute_index / cards_per_page);
	var next_card_relative_index = next_card_absolute_index - ((next_card_page_index - 1) * cards_per_page);
	var next_url = "https://api.scryfall.com/cards/search?format=json&include_extras=false&include_multilingual=false&order=name&page="
		+ next_card_page_index
		+ "&q=cmc%3E%3D0+-type%3Aland+-set_type%3Afunny&unique=cards";
	var next_scryfall_data = await getJSONFromURL(next_url);
	var next_card = next_scryfall_data.data[next_card_relative_index];
	var next_card_manacost = next_card.mana_cost;
	console.log("index:(" + next_card_absolute_index + "/" + total_cards + ") on page:(" + next_card_page_index + "-" + next_card_relative_index + ")");
	console.log("check work: " + (((next_card_page_index - 1) * cards_per_page) + next_card_relative_index));
	$("#card_img").attr("src", next_card.image_uris.normal);*/