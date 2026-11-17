const $ = id => document.getElementById(id);

let student = null;
let subject = "Maths";
let conversations = {
  "Maths": [],
  "English Grammar": []
};

let summaries = [];
let questions = [];
let answers = {};
let questionIndex = 0;
let testStarted = false;
let testFinished = false;
let elapsed = 0;
let clock = null;
let testClock = null;
let testSeconds = 480;
let currentAverage = Number(localStorage.getItem("examlyAverage") || 59);
let scores = JSON.parse(localStorage.getItem("examlyScores") || "[]");

const subjects = ["Maths", "English Grammar"];

// --------------------------------
// REGISTRATION
// --------------------------------

$("registerForm").addEventListener("submit", e => {
  e.preventDefault();

  student = {
    first: $("firstName").value.trim(),
    last: $("lastName").value.trim(),
    grade: $("grade").value
  };

  if (!student.first || !student.last || !student.grade) return;

  $("registration").classList.add("hidden");
  $("application").classList.remove("hidden");

  $("studentName").textContent = student.first + " " + student.last;
  $("studentGrade").textContent = "Class " + student.grade;
  $("avatar").textContent = student.first[0].toUpperCase();

  startPeriod();
});

// --------------------------------
// TEACHER SWITCHING
// --------------------------------

document.querySelectorAll(".subject-button").forEach(button => {
  button.addEventListener("click", () => {
    switchSubject(button.dataset.subject);
  });
});

function switchSubject(newSubject) {
  subject = newSubject;

  document.querySelectorAll(".subject-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.subject === subject
    );
  });

  $("teacherTitle").textContent = subject + " Teacher";
  renderConversation();
}

function renderConversation() {
  const area = $("chatMessages");
  area.innerHTML = "";

  const messages = conversations[subject];

  if (messages.length === 0) {
    area.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">✦</div>
        <h1>Let's learn ${subject}.</h1>
        <p>Ask your teacher a question to begin.</p>
      </div>
    `;
    return;
  }

  messages.forEach(message => {
    addMessage(message.role, message.content);
  });

  area.scrollTop = area.scrollHeight;
}

// --------------------------------
// CHAT SYSTEM
// --------------------------------

$("chatForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (elapsed >= 600 || testStarted) return;

  const input = $("messageInput");
  const message = input.value.trim();

  if (!message) return;

  input.value = "";
  await sendMessage(message);
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    sendMessage(button.textContent);
  });
});

function addMessage(role, content) {
  const area = $("chatMessages");

  const welcome = area.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = "message " + role;
  div.textContent = content;

  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

async function sendMessage(message) {
  if (elapsed >= 600 || testStarted) return;

  conversations[subject].push({
    role: "user",
    content: message
  });

  addMessage("user", message);
  addSummary(message);

  $("typing").classList.remove("hidden");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        grade: student.grade,
        messages: conversations[subject]
      })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Teacher unavailable.");

    conversations[subject].push({
      role: "assistant",
      content: data.reply
    });

    addMessage("assistant", data.reply);

  } catch (error) {
    addMessage(
      "assistant",
      "I couldn't connect to your teacher right now. Please check your AI API settings and try again."
    );
  } finally {
    $("typing").classList.add("hidden");
  }
}

// --------------------------------
// PERIOD SUMMARY
// --------------------------------

function addSummary(message) {
  const item = {
    subject,
    topic: message.length > 65
      ? message.substring(0, 65) + "..."
      : message
  };

  summaries.push(item);
  renderSummaries();
}

function renderSummaries() {
  const list = $("summaryList");

  if (!summaries.length) {
    list.innerHTML = `
      <div class="empty-summary">
        Your learning summaries will appear here.
      </div>`;
    return;
  }

  list.innerHTML = "";

  summaries.forEach(item => {
    const div = document.createElement("div");
    div.className = "summary-item";

    const title = document.createElement("strong");
    title.textContent = item.subject;

    const description = document.createElement("small");
    description.textContent = item.topic;

    div.append(title, description);
    list.appendChild(div);
  });
}

// --------------------------------
// 20-MINUTE PERIOD
// --------------------------------

// 0-10 minutes: learning
// 10-12 minutes: break
// 12-20 minutes: test

function startPeriod() {
  elapsed = 0;
  updatePeriod();

  clock = setInterval(() => {
    elapsed++;
    updatePeriod();

    if (elapsed >= 600 && elapsed < 720) {
      showBreak();
    }

    if (elapsed >= 720 && !testStarted) {
      beginTestPreparation();
    }

    if (elapsed >= 1200) {
      clearInterval(clock);
    }
  }, 1000);
}

function updatePeriod() {
  let remaining;
  let phase;
  let total;

  if (elapsed < 600) {
    remaining = 600 - elapsed;
    phase = "Learning session";
    total = 600;
  } else if (elapsed < 720) {
    remaining = 720 - elapsed;
    phase = "Lunch break";
    total = 120;
  } else {
    remaining = 1200 - elapsed;
    phase = "MCQ examination";
    total = 480;
  }

  $("timer").textContent = formatTime(remaining);
  $("phaseName").textContent = phase;
  $("timerBar").style.width = (remaining / total * 100) + "%";

  $("timerCaption").textContent =
    phase === "Learning session" ? "Time to understand concepts" :
    phase === "Lunch break" ? "Enjoy your break!" :
    "Complete your examination.";

  if (elapsed < 600) {
    $("nextTitle").textContent = "Lunch break";
    $("nextTime").textContent = formatTime(600 - elapsed);
    $("nextCaption").textContent = "A little time to relax.";
  } else if (elapsed < 720) {
    $("nextTitle").textContent = "Examination";
    $("nextTime").textContent = formatTime(720 - elapsed);
    $("nextCaption").textContent = "Your test starts after the break.";
  } else {
    $("nextTitle").textContent = "Test in progress";
    $("nextTime").textContent = formatTime(1200 - elapsed);
    $("nextCaption").textContent = "Your examination is underway.";
  }

  const phaseNumber = elapsed < 600 ? 1 : elapsed < 720 ? 2 : 3;

  for (let i = 1; i <= 3; i++) {
    const element = $("phase" + i);
    element.classList.toggle("active", i === phaseNumber);
    element.classList.toggle("done", i < phaseNumber);
  }

  if (elapsed >= 600) {
    $("chatForm").querySelector("textarea").disabled = true;
    $("chatForm").querySelector("button").disabled = true;
  }
}

function formatTime(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" + String(seconds % 60).padStart(2, "0");
}

// --------------------------------
// LUNCH BREAK
// --------------------------------

let breakScreen = null;

function showBreak() {
  if (breakScreen) return;

  breakScreen = document.createElement("section");
  breakScreen.style.cssText = `
    position:fixed;inset:0;z-index:15;
    background:rgba(8,8,13,.96);
    display:grid;place-items:center;text-align:center;
    padding:20px;
  `;

  breakScreen.innerHTML = `
    <div style="max-width:400px">
      <div style="font-size:65px">☕</div>
      <div style="color:#a78bfa;letter-spacing:2px;font-size:11px">
        EXAMLY AI · BREAK TIME
      </div>
      <h1 style="font-size:35px;margin:15px 0">Time to recharge.</h1>
      <p style="color:#9990a8;font-size:13px">
        Take a little break. Your examination is coming up next.
      </p>
      <div id="breakCountdown"
        style="font-size:55px;font-weight:800;color:#c4a8ff;margin:25px">
        02:00
      </div>
      <p style="color:#9990a8;font-size:11px">Your test begins automatically.</p>
    </div>
  `;

  document.body.appendChild(breakScreen);
}

function hideBreak() {
  if (breakScreen) {
    breakScreen.remove();
    breakScreen = null;
  }
}

// --------------------------------
// AUTOMATIC TEST PREPARATION
// --------------------------------

async function beginTestPreparation() {
  if (testStarted) return;
  testStarted = true;

  hideBreak();

  $("application").classList.add("hidden");
  $("testScreen").classList.remove("hidden");
  $("preparing").classList.remove("hidden");
  $("testContent").classList.add("hidden");

  $("testSubject").textContent = subject + " examination";

  await new Promise(resolve => setTimeout(resolve, 2000));

  $("preparing").querySelector("h2").textContent =
    "Your questions are being created...";

  const conversation = conversations[subject]
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  try {
    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        grade: student.grade,
        conversation
      })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Test preparation failed.");

    questions = data.questions;

  } catch (error) {
    $("preparing").querySelector("p").textContent =
      error.message + " Please try again after checking your connection.";
    $("preparing").querySelector("h2").textContent =
      "Examination preparation needs attention";
    return;
  }

  if (questions.length !== 30) {
    $("preparing").querySelector("h2").textContent =
      "The examination could not be prepared.";
    $("preparing").querySelector("p").textContent =
      "Please check the AI provider and try again.";
    return;
  }

  $("preparing").classList.add("hidden");
  $("testContent").classList.remove("hidden");

  questionIndex = 0;
  answers = {};

  renderQuestion();
  startTestClock();
}

// --------------------------------
// MCQ EXAMINATION
// --------------------------------

function renderQuestion() {
  const q = questions[questionIndex];

  $("questionProgress").textContent =
    `Question ${questionIndex + 1} of 30`;

  $("answeredCount").textContent =
    Object.keys(answers).length + " / 30 answered";

  $("questionBar").style.width =
    (Object.keys(answers).length / 30 * 100) + "%";

  const area = $("questionArea");
  area.innerHTML = "";

  const card = document.createElement("div");
  card.className = "question-card";

  const heading = document.createElement("h2");
  heading.textContent = q.question;
  card.appendChild(heading);

  q.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option";
    button.classList.toggle("selected", answers[questionIndex] === index);

    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = ["A", "B", "C"][index];

    button.append(letter, document.createTextNode(option));

    button.addEventListener("click", () => {
      if (testFinished) return;

      answers[questionIndex] = index;
      renderQuestion();
    });

    card.appendChild(button);
  });

  area.appendChild(card);

  $("previousQuestion").disabled = questionIndex === 0;
  $("nextQuestion").disabled = questionIndex === 29;

  const complete = Object.keys(answers).length === 30;

  $("submitTest").disabled = !complete;
  $("submitTest").classList.toggle("ready", complete);

  $("submitTest").textContent = complete
    ? "✓ Submit examination"
    : "Complete all questions first";
}

$("previousQuestion").addEventListener("click", () => {
  if (questionIndex > 0) {
    questionIndex--;
    renderQuestion();
  }
});

$("nextQuestion").addEventListener("click", () => {
  if (questionIndex < 29) {
    questionIndex++;
    renderQuestion();
  }
});

$("submitTest").addEventListener("click", () => {
  if (Object.keys(answers).length === 30) {
    finishTest();
  }
});

// --------------------------------
// 8-MINUTE TEST TIMER
// --------------------------------

function startTestClock() {
  testSeconds = 480;
  clearInterval(testClock);

  updateTestClock();

  testClock = setInterval(() => {
    testSeconds--;
    updateTestClock();

    if (testSeconds <= 0) {
      clearInterval(testClock);
      finishTest();
    }
  }, 1000);
}

function updateTestClock() {
  $("testTimer").textContent = formatTime(testSeconds);
}

// --------------------------------
// MARKING AND RESULTS
// --------------------------------

function finishTest() {
  if (testFinished) return;
  testFinished = true;

  clearInterval(testClock);

  let correct = 0;
  const review = [];

  questions.forEach((q, i) => {
    const selected = answers[i];
    const isCorrect = selected === q.answer;

    if (isCorrect) correct++;

    if (!isCorrect) {
      review.push({
        question: q.question,
        yourAnswer: selected === undefined
          ? "Not answered"
          : q.options[selected],
        correctAnswer: q.options[q.answer],
        explanation: q.explanation || ""
      });
    }
  });

  const percentage = Math.round(correct / 30 * 100);

  scores.push(percentage);
  currentAverage = Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  );

  localStorage.setItem("examlyScores", JSON.stringify(scores));
  localStorage.setItem("examlyAverage", currentAverage);

  $("testScreen").classList.add("hidden");
  $("resultsScreen").classList.remove("hidden");

  $("resultName").textContent = student.first;
  $("scorePercent").textContent = percentage + "%";
  $("correctScore").textContent = correct + "/30";
  $("wrongScore").textContent = 30 - correct;
  $("averageScore").textContent = currentAverage + "/100";

  $("resultMessage").textContent =
    percentage >= 90 ? "Outstanding work! Your understanding is excellent." :
    percentage >= 75 ? "Very good! Keep practising and improving." :
    percentage >= 50 ? "Good effort! Review your mistakes and try again." :
    "Keep learning. Every practice session helps you improve.";

  const reviewArea = $("reviewArea");
  reviewArea.innerHTML = "";

  if (review.length) {
    const heading = document.createElement("h3");
    heading.textContent = "Let's review your mistakes";
    heading.style.fontSize = "14px";
    reviewArea.appendChild(heading);

    review.forEach(item => {
      const div = document.createElement("div");
      div.className = "review-item";

      const title = document.createElement("strong");
      title.textContent = item.question;

      const yourAnswer = document.createElement("small");
      yourAnswer.textContent = "Your answer: " + item.yourAnswer;

      const correctAnswer = document.createElement("small");
      correctAnswer.textContent = "Correct answer: " + item.correctAnswer;

      const explanation = document.createElement("small");
      explanation.textContent = item.explanation;

      div.append(title, yourAnswer, correctAnswer, explanation);
      reviewArea.appendChild(div);
    });
  } else {
    reviewArea.textContent = "Perfect score! All 30 answers are correct.";
  }
}

// --------------------------------
// RETURN TO MAIN SCREEN
// --------------------------------

$("finishButton").addEventListener("click", () => {
  $("resultsScreen").classList.add("hidden");
  $("application").classList.remove("hidden");

  $("chatForm").querySelector("textarea").disabled = false;
  $("chatForm").querySelector("button").disabled = false;

  $("chatMessages").innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">✦</div>
      <h1>Excellent work!</h1>
      <p>Your examination has been saved. You can continue learning.</p>
    </div>
  `;

  $("phaseName").textContent = "Period completed";
  $("timer").textContent = "00:00";
  $("timerCaption").textContent = "See you next period!";
  $("nextTitle").textContent = "Completed";
  $("nextTime").textContent = "✓";
  $("nextCaption").textContent = "Your examination is finished.";
  $("timerBar").style.width = "0%";

  $("phase1").classList.add("done");
  $("phase2").classList.add("done");
  $("phase3").classList.add("done");
});
