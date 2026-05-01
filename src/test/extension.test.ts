import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { initializeParser } from '../phpParserUtil';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');


	// test the initialize parser function
	test('Initialize Parser', async () => {
		
		const parser = await initializeParser();
		assert.ok(parser, 'Parser should be initialized');
	});
});
