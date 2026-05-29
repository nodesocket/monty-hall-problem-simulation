const PHASE = {
  PICK: "pick",
  SWITCH: "switch",
  REVEAL: "reveal",
};

const AUTO_TIMING = {
  beforePick: 60,
  pickHighlight: 100,
  afterHostRemove: 160,
  decisionPause: 100,
  afterReveal: 180,
  betweenGames: 40,
};

let ballIndex = null;
let playerChoice = null;
let removedIndex = null;
let phase = PHASE.PICK;
let isAutoPlaying = false;
let autoPlayAvailable = true;
let stats = {
  correct: 0,
  attempts: 0,
  stay: { wins: 0, attempts: 0 },
  switch: { wins: 0, attempts: 0 },
};

const messageEl = document.getElementById("message");
const appEl = document.querySelector(".app");
const actionsEl = document.getElementById("actions");
const resultEl = document.getElementById("result");
const playAgainBtn = document.getElementById("play-again-btn");
const autoPlayBtn = document.getElementById("auto-play-btn");
const footerActionsEl = document.querySelector(".footer-actions");
const stayBtn = document.getElementById("stay-btn");
const switchBtn = document.getElementById("switch-btn");
const statsScoreEl = document.getElementById("stats-score");
const statsPercentEl = document.getElementById("stats-percent");
const statsStayPercentEl = document.getElementById("stats-stay-percent");
const statsStayLabelEl = document.getElementById("stats-stay-label");
const statsSwitchPercentEl = document.getElementById("stats-switch-percent");
const statsSwitchLabelEl = document.getElementById("stats-switch-label");
const cups = [...document.querySelectorAll(".cup")];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatPercent(wins, attempts) {
  if (attempts === 0) {
    return "—";
  }

  return `${Math.round((wins / attempts) * 100)}%`;
}

function formatChoiceLabel(prefix, wins, attempts) {
  if (attempts === 0) {
    return prefix;
  }

  return `${prefix} (${wins}/${attempts})`;
}

function updateStatsDisplay() {
  statsScoreEl.textContent = `${stats.correct} / ${stats.attempts}`;
  statsPercentEl.textContent = formatPercent(stats.correct, stats.attempts);

  statsStayPercentEl.textContent = formatPercent(
    stats.stay.wins,
    stats.stay.attempts
  );
  statsStayLabelEl.textContent = formatChoiceLabel(
    "Stay accuracy",
    stats.stay.wins,
    stats.stay.attempts
  );

  statsSwitchPercentEl.textContent = formatPercent(
    stats.switch.wins,
    stats.switch.attempts
  );
  statsSwitchLabelEl.textContent = formatChoiceLabel(
    "Switch accuracy",
    stats.switch.wins,
    stats.switch.attempts
  );
}

function resetStats() {
  stats.correct = 0;
  stats.attempts = 0;
  stats.stay.wins = 0;
  stats.stay.attempts = 0;
  stats.switch.wins = 0;
  stats.switch.attempts = 0;
  updateStatsDisplay();
}

function recordResult(won, didSwitch) {
  stats.attempts += 1;
  if (won) {
    stats.correct += 1;
  }

  const choiceStats = didSwitch ? stats.switch : stats.stay;
  choiceStats.attempts += 1;
  if (won) {
    choiceStats.wins += 1;
  }

  updateStatsDisplay();
}

function randomBallIndex() {
  return Math.floor(Math.random() * 3);
}

function getHostRemovalIndex(choice, ball) {
  const emptyCups = [0, 1, 2].filter((i) => i !== choice && i !== ball);
  return emptyCups[Math.floor(Math.random() * emptyCups.length)];
}

function getRemainingCup(choice, removed) {
  return [0, 1, 2].find((i) => i !== choice && i !== removed);
}

function hideAutoPlayButton() {
  if (!autoPlayAvailable) {
    return;
  }

  autoPlayAvailable = false;
  footerActionsEl.classList.add("hidden");
}

function clearAutoChoiceHighlight() {
  stayBtn.classList.remove("auto-choice");
  switchBtn.classList.remove("auto-choice");
}

function resetBoardVisuals() {
  phase = PHASE.PICK;
  playerChoice = null;
  removedIndex = null;
  clearAutoChoiceHighlight();
  actionsEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  resultEl.className = "result hidden";
  playAgainBtn.classList.add("hidden");

  cups.forEach((cup) => {
    cup.disabled = true;
    cup.className = "cup";
    const reveal = cup.querySelector(".cup-reveal");
    reveal.textContent = "";
    reveal.classList.remove("ball");
    reveal.setAttribute("aria-hidden", "true");
  });
}

function setInteractiveEnabled(enabled) {
  const allowInput = enabled && !isAutoPlaying;
  autoPlayBtn.disabled = !allowInput;
  playAgainBtn.disabled = !allowInput;
  stayBtn.disabled = !allowInput;
  switchBtn.disabled = !allowInput;

  cups.forEach((cup) => {
    cup.disabled = !allowInput || phase !== PHASE.PICK;
  });
}

function getSwitchPromptMessage() {
  const remaining = getRemainingCup(playerChoice, removedIndex);
  return `The host removed cup ${removedIndex + 1} — it was empty. Do you want to switch to cup ${remaining + 1}, or stay with cup ${playerChoice + 1}?`;
}

function applyPick(index) {
  playerChoice = index;
  phase = PHASE.SWITCH;

  cups.forEach((cup, i) => {
    cup.classList.toggle("selected", i === index);
    cup.disabled = true;
  });

  removedIndex = getHostRemovalIndex(playerChoice, ballIndex);
  const removedCup = cups[removedIndex];
  removedCup.classList.add("removed");
  const removedReveal = removedCup.querySelector(".cup-reveal");
  removedReveal.classList.remove("ball");
  removedReveal.textContent = "✕";
  removedReveal.setAttribute("aria-hidden", "false");

  messageEl.textContent = getSwitchPromptMessage();
  actionsEl.classList.remove("hidden");
}

async function animatePick(index, gameLabel) {
  const cup = cups[index];
  messageEl.textContent = `${gameLabel}: Choosing cup ${index + 1}…`;
  cup.classList.add("auto-picking");
  await wait(AUTO_TIMING.pickHighlight);
  cup.classList.remove("auto-picking");
  applyPick(index);
  messageEl.textContent = `${gameLabel}: Host removed cup ${removedIndex + 1} — it was empty.`;
  await wait(AUTO_TIMING.afterHostRemove);
}

function finishGame(didSwitch, { auto = false, gameLabel = "" } = {}) {
  phase = PHASE.REVEAL;

  const finalChoice = didSwitch
    ? getRemainingCup(playerChoice, removedIndex)
    : playerChoice;

  actionsEl.classList.add("hidden");
  clearAutoChoiceHighlight();

  cups.forEach((cup, i) => {
    cup.classList.remove("selected");
    cup.classList.add("revealed");

    const reveal = cup.querySelector(".cup-reveal");
    reveal.setAttribute("aria-hidden", "false");

    if (i === ballIndex) {
      reveal.textContent = "";
      reveal.classList.add("ball");
      cup.classList.add("winner");
    } else {
      reveal.textContent = "✕";
      reveal.classList.remove("ball");
    }

    if (i === finalChoice && i !== ballIndex) {
      cup.classList.add("selected");
    }
  });

  const won = finalChoice === ballIndex;
  recordResult(won, didSwitch);

  if (auto) {
    const choiceLabel = didSwitch ? "Switched" : "Stayed";
    messageEl.textContent = `${gameLabel}: ${choiceLabel} — ${won ? "found" : "missed"} the ball under cup ${ballIndex + 1}.`;
    return won;
  }

  resultEl.classList.remove("hidden");
  resultEl.classList.add(won ? "win" : "lose");
  resultEl.textContent = won
    ? `You win! The ball was under cup ${ballIndex + 1}.`
    : `You lose. The ball was under cup ${ballIndex + 1}.`;

  const choiceLabel = didSwitch ? "switched" : "stayed";
  messageEl.textContent = `You ${choiceLabel} and picked cup ${finalChoice + 1}. Here's what's under each cup:`;
  playAgainBtn.classList.remove("hidden");
  return won;
}

async function animateDecision(didSwitch, gameLabel) {
  const remaining = getRemainingCup(playerChoice, removedIndex);
  const chosenBtn = didSwitch ? switchBtn : stayBtn;

  messageEl.textContent = didSwitch
    ? `${gameLabel}: Switching to cup ${remaining + 1}…`
    : `${gameLabel}: Staying with cup ${playerChoice + 1}…`;

  chosenBtn.classList.add("auto-choice");
  await wait(AUTO_TIMING.decisionPause);
}

async function playAnimatedRound(gameNumber, totalGames) {
  const gameLabel = `Game ${gameNumber}/${totalGames}`;

  resetBoardVisuals();
  ballIndex = randomBallIndex();

  messageEl.textContent = `${gameLabel}: Ball hidden. Picking a cup…`;
  await wait(AUTO_TIMING.beforePick);

  const choice = randomBallIndex();
  await animatePick(choice, gameLabel);

  const didSwitch = Math.random() < 0.5;
  await animateDecision(didSwitch, gameLabel);
  finishGame(didSwitch, { auto: true, gameLabel });
  await wait(AUTO_TIMING.afterReveal);
  await wait(AUTO_TIMING.betweenGames);
}

async function runAutoGames(count) {
  if (isAutoPlaying || !autoPlayAvailable) {
    return;
  }

  isAutoPlaying = true;
  appEl.classList.add("auto-playing");
  setInteractiveEnabled(false);
  resetStats();
  autoPlayBtn.textContent = `Playing game 0/${count}…`;

  for (let game = 1; game <= count; game += 1) {
    autoPlayBtn.textContent = `Playing game ${game}/${count}…`;
    await playAnimatedRound(game, count);
  }

  isAutoPlaying = false;
  appEl.classList.remove("auto-playing");
  resetGame();
  messageEl.textContent = `Finished ${count} automatic games. Stats updated above.`;
  autoPlayBtn.textContent = "Play 100 games automatically, randomly switching or staying cups.";
  setInteractiveEnabled(true);
}

function resetGame() {
  if (isAutoPlaying) {
    return;
  }

  ballIndex = randomBallIndex();
  playerChoice = null;
  removedIndex = null;
  phase = PHASE.PICK;
  clearAutoChoiceHighlight();

  messageEl.textContent =
    "The ball is hidden under one of three cups at random. Which cup do you choose?";
  actionsEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  resultEl.className = "result hidden";
  playAgainBtn.classList.add("hidden");

  cups.forEach((cup) => {
    cup.disabled = false;
    cup.className = "cup";
    const reveal = cup.querySelector(".cup-reveal");
    reveal.textContent = "";
    reveal.classList.remove("ball");
    reveal.setAttribute("aria-hidden", "true");
  });
}

function onCupClick(event) {
  if (isAutoPlaying || phase !== PHASE.PICK) {
    return;
  }

  hideAutoPlayButton();
  applyPick(Number(event.currentTarget.dataset.index));
}

cups.forEach((cup) => cup.addEventListener("click", onCupClick));
stayBtn.addEventListener("click", () => {
  if (!isAutoPlaying && phase === PHASE.SWITCH) {
    finishGame(false);
  }
});
switchBtn.addEventListener("click", () => {
  if (!isAutoPlaying && phase === PHASE.SWITCH) {
    finishGame(true);
  }
});
playAgainBtn.addEventListener("click", resetGame);
autoPlayBtn.addEventListener("click", () => runAutoGames(100));

resetGame();
updateStatsDisplay();
