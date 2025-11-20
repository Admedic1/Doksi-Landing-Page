function sendLeadToZapier(userData) {
  const payload = {
    name: userData.name,
    email: userData.email,
    phone: userData.phone,
    address: userData.address
  };
  
  console.log("Sending lead to Zapier and Google Sheets:", payload);
  console.log("Payload JSON string:", JSON.stringify(payload));
  
  // Send to Zapier (primary)
  fetch("https://hooks.zapier.com/hooks/catch/23450484/u8v689f/", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(response => {
    console.log("✅ Zapier response status:", response.status);
    return response.text();
  })
  .then(data => {
    console.log("Zapier response data:", data);
  })
  .catch(error => {
    console.error("❌ Error sending lead to Zapier:", error);
  });
  
  // Send to Google Sheets (backup)
  const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwWkTzfGurKHnNc5Xd1n0oA-la1TYVL12ZXJkps9PFT_bC6nsrGuSD_PGcXQD3u9DQ7/exec";
  
  if (GOOGLE_SHEET_URL && !GOOGLE_SHEET_URL.includes("PASTE_YOUR")) {
    fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
    .then(response => {
      console.log("✅ Google Sheets backup status:", response.status);
      return response.json();
    })
    .then(data => {
      console.log("Google Sheets backup response:", data);
    })
    .catch(error => {
      console.error("❌ Error sending to Google Sheets backup:", error);
    });
  } else {
    console.warn("⚠️ Google Sheets backup URL not configured yet");
  }
}

console.log("script loaded");

// -------------------------------------------------
//          QUIZ LOGIC BELOW
// -------------------------------------------------

(function() {
    'use strict';

    let currentStep = 0;
    let userData = {};

    const quizData = {
        steps: ['step0', 'step1', 'step2', 'step3', 'step4', 'step5'],
        progress: [0, 20, 40, 60, 80, 100]
    };

    function initQuiz() {
        const quizOptions = document.querySelectorAll('.quiz-option[data-answer]');
        const nextButtons = document.querySelectorAll('.quiz-btn-next');

        quizOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleInitialQuestion.call(this, e);
            });
        });

        nextButtons.forEach((btn, index) => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleNextStep(index + 1);
            });
        });

        const inputs = document.querySelectorAll('.quiz-input');
        inputs.forEach((input, index) => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNextStep(index + 1);
                }
            });
        });
    }

    function handleInitialQuestion(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const answer = this.getAttribute('data-answer');

        if (answer === 'no') {
            alert('We primarily work with homeowners.');
            return;
        }

        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('quiz-option-primary');
        });

        this.classList.add('quiz-option-primary');

        userData.homeowner = answer;
        setTimeout(() => showStep(1), 300);
    }

    function handleNextStep(stepIndex) {
        const input = getInputForStep(stepIndex);
        if (!input) return;

        const value = input.value.trim();
        if (!value) {
            input.focus();
            input.style.borderColor = '#ef4444';
            setTimeout(() => input.style.borderColor = '', 2000);
            return;
        }

        // Email validation for step 2
        if (stepIndex === 2) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                input.focus();
                input.style.borderColor = '#ef4444';
                setTimeout(() => input.style.borderColor = '', 2000);
                return;
            }
        }

        if (stepIndex === 1) {
            userData.name = value;
            updatePersonalizedMessages(value);
        } else if (stepIndex === 2) {
            userData.email = value;
        } else if (stepIndex === 3) {
            userData.phone = value;
        } else if (stepIndex === 4) {
            userData.address = value;

            // SEND TO ZAPIER HERE - function is in global scope
            sendLeadToZapier(userData);
        }

        if (stepIndex < 4) {
            showStep(stepIndex + 1);
        } else {
            showStep(5);
        }
    }

    function getInputForStep(stepIndex) {
        const inputs = {
            1: document.getElementById('userName'),
            2: document.getElementById('userEmail'),
            3: document.getElementById('userPhone'),
            4: document.getElementById('userAddress')
        };
        return inputs[stepIndex];
    }

    function updatePersonalizedMessages(name) {
        const step2Title = document.getElementById('step2Title');
        const step3Title = document.getElementById('step3Title');
        const step4Title = document.getElementById('step4Title');

        if (step2Title) step2Title.textContent = `Hey ${name}! 👋`;
        if (step3Title) step3Title.textContent = `Almost there, ${name}! 🚀`;
        if (step4Title) step4Title.textContent = `Last step, ${name}! 🎉`;
    }

    function showStep(stepIndex) {
        document.querySelectorAll('.quiz-step').forEach(step => {
            step.classList.add('hidden');
        });

        const currentStepEl = document.getElementById(quizData.steps[stepIndex]);
        if (currentStepEl) {
            currentStepEl.classList.remove('hidden');

            const progressBar = currentStepEl.querySelector('.progress-bar');
            if (progressBar) progressBar.style.width = quizData.progress[stepIndex] + '%';

            // Focus first input if exists
            const input = currentStepEl.querySelector('.quiz-input');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }

            // Scroll quiz into view on mobile
            if (window.innerWidth < 768) {
                const quizCard = document.getElementById('quizCard');
                if (quizCard) {
                    quizCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        // Hide footer on success step
        const footer = document.getElementById('quizFooter');
        if (footer) {
            footer.style.display = stepIndex === 5 ? 'none' : 'block';
        }

        currentStep = stepIndex;
    }

    function initCTAs() {
        const ctaButtons = document.querySelectorAll('.btn-primary, .btn-lg');
        ctaButtons.forEach(btn => {
            if (!btn.closest('.quiz-card')) {
                btn.addEventListener('click', function(e) {
                    const quizCard = document.getElementById('quizCard');
                    if (quizCard) {
                        e.preventDefault();
                        quizCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // If on step 0, trigger first question
                        if (currentStep === 0) {
                            const firstOption = document.querySelector('.quiz-option[data-answer="yes"]');
                            if (firstOption) {
                                setTimeout(() => firstOption.click(), 500);
                            }
                        }
                    }
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initQuiz();
            initCTAs();
        });
    } else {
        initQuiz();
        initCTAs();
    }
})();
