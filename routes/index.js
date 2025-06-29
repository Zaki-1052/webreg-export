const fs = require('fs');

const express = require('express');
const router = express.Router();

const multer = require('multer');

const parseHTML = require('../config/parse/parseHTML');
const constants = require('../config/parse/constants');
const { 
  getAvailableQuarters, 
  updateCurrentQuarters, 
  getAllQuarters,
  initializeQuarters 
} = require('../config/quarterManager');
const { getQuarterAcademicEvents } = require('../config/academicCalendarService');
const { adminMiddleware, validateAdminSecurity } = require('../config/adminAuth');

// Initialize quarters file on startup
initializeQuarters().catch(console.error);

// multer storage for uploaded schedule photos
const storage = multer.diskStorage({
	destination: './tmp/uploads',
	filename: (req, file, cb) => {
		try {
			const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
			cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1])
		} catch (err) {
			console.log(err);
		}
	}
})

// multer upload object with limit config and file filter to prevent unwanted uploads
const upload = multer({
	storage: storage,
	limits: {
		fields: 25,
		fileSize: 10000000,
		files: 5,
	},
	fileFilter: (req, file, cb) => {
		const ua = req.headers['user-agent'];
		console.log('User Agent: ' + ua);
		console.log('Mimetype: ' + file.mimetype);;
		if (req.path === '/converthtml' && (file.mimetype === 'text/html'
			|| (file.mimetype === 'application/octet-stream' && file.originalname.endsWith('.webarchive')))) {
			return cb(null, true);
		}

		return cb(null, false);
	}
})

/* GET home page. */
router.get('/', (req, res, next) => {
	return res.sendStatus(200);
});

// convert html to ICS, returns 400 if no image or quarter is provided, 500 if error occurs
router.post('/converthtml', upload.single('html'), async (req, res, next) => {
	console.log(req.file.size / 1000 + ' KB');
	// delete file after 10 seconds
	if (req.file) {
		setTimeout(() => {
			fs.unlink(req.file.path, (err) => {
				if (err) {
					console.log(err);
				}
			});
		}, 10000)
	}

	// Get all quarters (dynamic + static)
	const allQuarters = await getAllQuarters();

	// if no file or invalid quarter, invalid request, return 400
	if (!req.file || !Object.keys(allQuarters).includes(req.body.quarter)) {
		return res.sendStatus(400);
	}

	// try to parse image, if error occurs, return 500
	try {
		const html = fs.readFileSync(req.file.path, 'utf8');

		let text;
		try {
			text = parseHTML.getText(html);
		} catch (error) {
			console.log(error);
			return res.status(500).send(error.message);
		}
		
		// Pass the quarter data to parseHTML
		const quarterData = allQuarters[req.body.quarter];
		let icsData = parseHTML.getICS(text, req.body.quarter, false, quarterData);
		
		// Include academic calendar events if requested
		if (req.body.includeAcademicCalendar === 'true') {
			try {
				const academicEvents = await getQuarterAcademicEvents(req.body.quarter, quarterData);
				icsData = [...icsData, ...academicEvents];
			} catch (error) {
				console.error('Failed to fetch academic calendar events:', error);
				// Continue without academic events on error
			}
		}
		
		return res.json(JSON.stringify(icsData))
	} catch (error) {
		console.log(error);
		return res.status(500).send('Server error when creating schedule. Please try again later.');
	}
})

// GET available quarters with metadata
router.get('/quarters', async (req, res) => {
	try {
		const quartersData = await getAvailableQuarters();
		return res.json(quartersData);
	} catch (error) {
		console.error('Error fetching quarters:', error);
		return res.status(500).json({ error: 'Failed to fetch quarters' });
	}
});

// POST update quarters (manual trigger)
// Protected by comprehensive admin authentication middleware
router.post('/update-quarters', adminMiddleware(), async (req, res) => {
	try {
		console.log('[ADMIN] Manually updating quarters...');
		const startTime = Date.now();
		
		const updatedQuarters = await updateCurrentQuarters();
		const duration = Date.now() - startTime;
		
		// Log successful admin action
		console.log('[ADMIN SUCCESS]', JSON.stringify({
			action: 'update-quarters',
			duration: `${duration}ms`,
			quartersCount: Object.keys(updatedQuarters).length,
			timestamp: new Date().toISOString()
		}));
		
		return res.json({
			success: true,
			message: 'Quarters updated successfully',
			quartersCount: Object.keys(updatedQuarters).length,
			duration: `${duration}ms`
		});
	} catch (error) {
		console.error('[ADMIN ERROR] Failed to update quarters:', error);
		return res.status(500).json({ 
			error: 'Failed to update quarters',
			message: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
})

// GET academic calendar events for a specific quarter
router.get('/academic-calendar/:quarter', async (req, res) => {
	try {
		const allQuarters = await getAllQuarters();
		const quarterData = allQuarters[req.params.quarter];
		
		if (!quarterData) {
			return res.status(404).json({ error: 'Quarter not found' });
		}
		
		const academicEvents = await getQuarterAcademicEvents(req.params.quarter, quarterData);
		return res.json(academicEvents);
	} catch (error) {
		console.error('Error fetching academic calendar:', error);
		return res.status(500).json({ error: 'Failed to fetch academic calendar' });
	}
});

module.exports = router;
