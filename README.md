# Bankin' Web Scrapping Challenge

* [Blog post](https://blog.bankin.com/challenge-engineering-web-scrapping-dc5839543117)
* [Tweet](https://twitter.com/bankin/status/948959710580846592)

## Requirements

* A recent Node.js (along with npm) version (>= v8.9)

## Installation

1. Clone or download this repository
2. Navigate to the directory, then run `npm install` to install dependencies

## Usage

* Run `npm start` to launch the script. Progress and other info will be logged to the console during the data extraction. Once everything is done, you should find a file named `operations.json` containing all the extracted data.
* Run `npm run debug` to launch the script in debug mode. It does the same thing as the previous command, plus it launches the browser in GUI mode and pass through in-page console messages to make debugging easier.
* If using VSCode, it's even easier to debug thanks to the built-in debugger (see `launch.json` configuration).
