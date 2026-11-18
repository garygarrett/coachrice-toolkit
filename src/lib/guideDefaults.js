// Starter sections for the FAQ / Guide. Admins can load these once (FAQ / Guide > Edit) and then change, add, or remove
// anything. After they are loaded, the copy in the database is the real one; this file is only the starting point.
// Audiences: 'participant' (CoachRICE participants), 'mentor' (mentor coaches), 'tool_admin' (tool-only admins).

const MENTOR = ['mentor', 'tool_admin']

export const STARTER_SECTIONS = [
  {
    title: 'Welcome',
    audiences: MENTOR,
    body: `The CoachRICE Toolkit helps you complete the ICF **Session Observation Form** for each coaching session you observe, and the **Competency Review Form** that sums up a participant's three observations.

The tool does the busy work. It reads the transcript, highlights likely evidence for each ICF behavior, and fills in the original ICF Word form for you. **You make every decision:** you edit the evidence, choose each rating, and write your own feedback. Nothing is pre-selected for you.

This guide walks through the steps in order. Use the section list to jump to what you need.`,
  },
  {
    title: 'Signing in for the first time',
    audiences: MENTOR,
    body: `Your program administrator gives you a **one-time access code**. It works once, to create your account.

1. Go to the CoachRICE Toolkit and choose **Mentor Coach** on the sign-in options page.
2. Open the **First time signing in** tab at the top of the box.
3. Type your access code and select **Continue**.
4. Enter your email address, then type your password twice. Choose a password you will remember.
5. Select the button to create your account. You land on your Session Observation Form home screen.

![The sign-in options page. Choose Mentor Coach.](/guide/01-sign-in-options.png)

![Use the First time signing in tab, then enter your one-time access code.](/guide/03-first-time.png)

If you mistyped your email, ask CoachRICE to correct it. An administrator can fix it for you.`,
  },
  {
    title: 'Signing in after that',
    audiences: MENTOR,
    body: `Choose **Mentor Coach** on the sign-in options page. The **Sign in** tab is the first one you see. Enter your email and password.

![The Mentor Coach sign-in page.](/guide/02-sign-in.png)

**Forgot your password?** Select **Forgot password?**, enter your email, and the system sends you a link to set a new one.`,
  },
  {
    title: 'Your home screen',
    audiences: MENTOR,
    body: `Everything starts on the **Session Observation Form** page. From top to bottom:

- **Cohort** (only if you work with more than one cohort). Pick a cohort to limit the lists below to that group.
- **Your Saved Forms.** Session Observation Forms and Competency Review Forms (tagged CRF) are listed together. **In progress** holds forms you have started. **Completed** holds forms with every field filled in. Select **Open** to continue a form.
- **By participant.** Pick a participant to see their SOF #1, #2, and #3 and their Competency Review Form, with the status of each. Select **Start SOF #2**, for example, to begin the next one.
- **What would you like to create?** Switch between a Session Observation Form and a Competency Review Form.

![Choose a participant under "By participant" to see all of their forms in one place.](/guide/04-start-screen.png)

You only see the participants assigned to you. If a participant is missing, email CoachRICE and they will assign them.`,
  },
  {
    title: 'Starting a Session Observation Form',
    audiences: MENTOR,
    body: `1. Under **Who is this observation for?**, choose the participant, then choose **SOF #1, #2, or #3**. The participant's name fills in on the form for you.
2. Add the coaching session as a transcript: select the box to choose a **.txt or .pdf** file, or paste the text into the large box. Speaker names and timestamps help, for example \`[05:32] Coach: ...\`.
3. Optional: choose the **recording** so you can listen along while you review. The recording plays only on your computer. It is never uploaded or stored. A recording cannot replace the transcript.
4. Select **Continue**.

![Choose the participant and form number, then add the transcript.](/guide/05-start-observation.png)

A form number that is already saved shows **Already saved**. Pick a different number, or open the saved form instead.`,
  },
  {
    title: 'Telling the tool who is who',
    audiences: MENTOR,
    body: `On the **Who is who?** screen, choose which speaker is the **Coach** (the participant you are evaluating) and which is the **Client**. Then select **Find evidence**.

![Match each speaker to Coach or Client.](/guide/06-who-is-who.png)

The tool now looks through the transcript and highlights possible evidence for each of the 20 ICF behaviors. This takes a short while. The result is a **starting point only**. You review and change all of it.`,
  },
  {
    title: 'Working in the form',
    audiences: MENTOR,
    body: `The form screen has three parts: the **transcript** on the left, the **ICF form** in the middle, and a narrow **Jump** bar on the right.

![The transcript, the Jump to bar, and the form, side by side.](/guide/07-form-overview.png)

### Rate each behavior
Each competency card lists its behaviors. Choose one rating for every behavior: Exceeds, Meets, Below, Does Not Meet, or N/A.

### Add or remove evidence
- Select a behavior. The transcript highlights its evidence.
- Select **+** on a transcript turn to add the whole turn as evidence.
- Or select words in the transcript, then choose **Add selected words**.
- Select **×** next to an evidence line to remove it.
- Type your own notes in the notes box under the evidence.

![Rate each behavior and review its evidence. The selected behavior is outlined.](/guide/08-evidence-ratings.png)

### Move around
Use the **Jump** bar on the right to go to Form details, Competency 1 and the other competencies (each shows a count like 3/4 for behaviors rated; hover to see the full name), or Signature. If you added a recording, select a timestamp to hear that moment.

### Feedback
At the end of each competency card, add **Areas of Strength** and **Areas for Development** for that competency.`,
  },
  {
    title: 'Saving, finishing, and downloading',
    audiences: MENTOR,
    body: `- **Save progress** stores your work so you can finish later. The form also saves on its own about 30 seconds after you change something. It keeps the transcript text, your answers, and your evidence. It never keeps audio.
- **Back to my observations** saves, then returns you to your home screen.
- The form's name updates itself, for example **Dana Ortiz - SOF #1 (Incomplete)**. It changes to **Complete** once every field is filled in.
- **Download form (.docx)** fills in the original ICF Word form for you to keep or send.
- **Download annotated transcript (PDF)** gives you the transcript with your evidence highlighted and tagged by behavior.

![Finish with the attestation, your printed name, signature, and date. Then download.](/guide/09-signature-save.png)

At the bottom, the **Save** card lists anything still blank, so you know what is left before you download.`,
  },
  {
    title: 'The Competency Review Form',
    audiences: MENTOR,
    body: `The Competency Review Form sums up a participant's Session Observation Forms #1 to #3. There is one per participant.

1. On your home screen, select **Competency Review Form** under **What would you like to create?**, choose the participant, and select **Continue**. You can also select **Start Competency Review** from the participant's row under **By participant**.
2. The form opens **pre-filled** from the participant's saved Session Observation Forms. A behavior shows **Proficiency Demonstrated** if any of their forms rated it Meets or Exceeds. It shows **Not Yet Demonstrated** if it was rated but never reached Meets. It stays blank if no form rated it.
3. **Change anything that needs changing.** The pre-fill is a suggestion, and you decide.
4. Fill in the remaining fields, then use **Save progress** and **Download form (Word)**.

![Start the review from the home screen.](/guide/10-review-start.png)

![The review opens pre-filled from the participant's forms.](/guide/11-review-form.png)

If you change a Session Observation Form later, select **Refresh from Session Observation Forms** to bring the review up to date. The tool asks you to confirm first.`,
  },
  {
    title: 'Viewing a Session Observation Form beside the review',
    audiences: MENTOR,
    body: `While you work on a review, you can read the participant's saved Session Observation Forms right next to it. There is no new tab and no download.

- Select a **SOF #** button above the review, or select a small rating chip (for example **#1 · Meets**) under a behavior. The form opens on the right, scrolled to that behavior.
- The review stays editable while the panel is open.
- Drag the panel's left edge to make it wider or narrower. Select **Close** when you are done.

![A saved Session Observation Form opens beside the review.](/guide/12-review-side-panel.png)`,
  },
  {
    title: 'Your data and privacy',
    audiences: MENTOR,
    body: `- The transcript text is sent to Claude (made by Anthropic) so it can suggest evidence. Recordings are never uploaded or stored.
- When you select **Save progress**, CoachRICE keeps the transcript text and your answers so you can finish later.
- You see only your own forms and the participants assigned to you. Program administrators can review saved observations.`,
  },
  {
    title: 'Common questions',
    audiences: MENTOR,
    body: `### I can't find a participant.
Participants are assigned to you by an administrator. Email CoachRICE and they will add the participant.

### It says that form number is already saved.
That participant already has that form. Choose a different form number, or open the saved form from **By participant**.

### Can I start a form on one day and finish on another?
Yes. Select **Save progress** (or **Back to my observations**). The form waits under **In progress** on your home screen.

### Who sees my ratings and feedback?
The forms you create are saved to your account, and program administrators can review them. The AI only suggests evidence. It does not choose ratings for you.

### I forgot my password.
Use **Forgot password?** on the Sign in tab. The system emails you a reset link.`,
  },
]
