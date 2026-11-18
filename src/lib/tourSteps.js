// The guided tours for the Session Observation Form page. `target` is a CSS selector for the item to highlight;
// steps whose item is not on the screen (for example the cohort filter for someone with one cohort) are skipped.
// If you change the screen, update the matching step here and its data-tour marker in SessionObservation.jsx.

export const HOME_TOUR = [
  {
    title: 'Welcome to your home page',
    body: 'This one-minute tour shows what each part of this page does. You can leave at any time, and you can replay it later with the Take a quick tour button.',
  },
  {
    target: '[data-tour="home-cohort"]',
    title: 'Pick a cohort',
    body: 'If you work with more than one cohort, choose one here. The lists below then show only that group.',
  },
  {
    target: '[data-tour="home-saved"]',
    title: 'Your Saved Forms',
    body: 'Your Session Observation Forms and Competency Review Forms (tagged CRF) are listed together here. In progress holds forms you have started. Completed holds forms with every field filled in. Select Open to keep working on a form. Delete removes the saved copy for good.',
  },
  {
    target: '[data-tour="home-byparticipant"]',
    title: 'See one participant at a time',
    body: 'Open By participant and choose a name. You will see their SOF #1, #2, and #3 and their Competency Review Form, with the status of each. Select Start next to the one you want to begin.',
  },
  {
    target: '[data-tour="home-choice"]',
    title: 'Choose what to create',
    body: 'Use these two buttons to switch between a Session Observation Form (one coaching session) and a Competency Review Form (the summary of a participant’s three forms). The page below changes, and you stay where you are.',
  },
  {
    target: '[data-tour="home-who"]',
    title: 'Who is this observation for?',
    body: 'Choose the participant, then choose SOF #1, #2, or #3. The participant’s name fills in on the ICF form for you. A form number that is already saved cannot be started twice.',
  },
  {
    target: '[data-tour="home-transcript"]',
    title: 'Add the transcript',
    body: 'Choose a .txt or .pdf file, drop one here, or paste the text into the box below. You can also add a recording to listen along. The recording stays on your computer and is never uploaded.',
  },
  {
    target: '[data-tour="home-continue"]',
    title: 'Continue',
    body: 'Select Continue. You will name the speakers, and then the tool highlights possible evidence for each ICF behavior. It only suggests. You edit the evidence and choose every rating.',
  },
  {
    title: 'That is the home page',
    body: 'Open a saved form or start a new one to see the form tour. You can find written steps and screenshots in FAQ / Guide, and you can email CoachRICE@rice.edu with any question.',
  },
]

export const FORM_TOUR = [
  {
    title: 'Welcome to the observation form',
    body: 'The transcript is on the left, the ICF form is in the middle, and a narrow Jump bar is on the right. This short tour walks through each part.',
  },
  {
    target: '[data-tour="form-toolbar"]',
    title: 'Save and download',
    body: 'Back to my observations saves and returns you home. Save progress keeps your work, and the form also saves itself about 30 seconds after any change. Download form (.docx) fills in the original ICF Word form. The annotated transcript PDF shows your evidence highlighted.',
  },
  {
    target: '[data-tour="form-transcript"]',
    title: 'The transcript',
    body: 'The evidence for the behavior you have selected is highlighted here. If you added a recording, select a timestamp to hear that moment.',
  },
  {
    target: '[data-tour="form-add-turn"]',
    title: 'Add evidence',
    body: 'Select + to add a whole turn as evidence for the selected behavior. You can also select words in the transcript and press Add selected words above. Select the same button again to remove evidence.',
  },
  {
    target: '[data-tour="form-jump"]',
    title: 'Jump to a section',
    body: 'Use these buttons to move between Form details (Info), Competency 1, Competencies 3 to 8, and Signature (Sign). Hover over a button to see its full name. The small number, like 3/4, shows how many behaviors you have rated.',
  },
  {
    target: '#sec-c3',
    title: 'Rate each behavior',
    body: 'Every competency card lists its behaviors. Choose one rating for each, review its evidence, and add your own notes. At the bottom of each card, write the Areas of Strength and Areas for Development.',
  },
  {
    target: '#sec-sign',
    title: 'Sign and finish',
    body: 'Confirm the attestation, type your name, signature, and date, then use the Save card below to see anything still blank. When every field is filled in, the form moves to Completed.',
  },
  {
    title: 'You are ready',
    body: 'Select the Take a quick tour button in the top bar to replay this tour. FAQ / Guide has written steps and screenshots, and you can email CoachRICE@rice.edu with any question.',
  },
]
