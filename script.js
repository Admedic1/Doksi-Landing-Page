function sendLeadToZapier(userData) {
  // VALIDATION: Ensure all fields are filled before sending
  if (!userData.name || !userData.zip || !userData.email || !userData.phone) {
    console.error("❌ BLOCKED: Cannot send incomplete lead data", userData);
    alert("Please fill out all fields before submitting.");
    return false;
  }
  
  // Additional validation: Check for empty/whitespace-only values
  if (!userData.name.trim() || !userData.zip.trim() || !userData.email.trim() || !userData.phone.trim()) {
    console.error("❌ BLOCKED: Cannot send blank lead data", userData);
    return false;
  }
  
  const payload = {
    name: userData.name.trim(),
    zip: userData.zip.trim(),
    email: userData.email.trim(),
    phone: userData.phone.trim(),
    ab_variant: window.abTestVariant || 'unknown'
  };
  
  console.log("✅ Validation passed. Sending lead to Zapier and Google Sheets:", payload);
  console.log("Payload JSON string:", JSON.stringify(payload));
  
  let zapierSuccess = false;
  let sheetsSuccess = false;
  
  // Send to Zapier (primary)
  fetch("https://hooks.zapier.com/hooks/catch/23450484/u8v689f/", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(response => {
    zapierSuccess = response.ok;
    console.log(zapierSuccess ? "✅ Zapier response status:" : "⚠️ Zapier response status:", response.status);
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
      sheetsSuccess = response.ok;
      console.log(sheetsSuccess ? "✅ Google Sheets backup status:" : "⚠️ Google Sheets backup status:", response.status);
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
  
  return true;
}

console.log("script loaded - v3.0");

// -------------------------------------------------
//          A/B TEST LOGIC
// -------------------------------------------------

(function initABTest() {
    // Check if user already has an assigned variant
    let variant = localStorage.getItem('ab_test_variant');
    
    // If no variant assigned, randomly assign one
    if (!variant) {
        variant = Math.random() < 0.5 ? 'A' : 'B';
        localStorage.setItem('ab_test_variant', variant);
        console.log('🧪 A/B Test: New visitor assigned to Variant', variant);
    } else {
        console.log('🧪 A/B Test: Returning visitor - Variant', variant);
    }
    
    // Store variant globally for tracking
    window.abTestVariant = variant;
    
    // If Variant B, show the before/after image
    if (variant === 'B') {
        document.addEventListener('DOMContentLoaded', function() {
            const abTestImage = document.getElementById('abTestImage');
            if (abTestImage) {
                abTestImage.style.display = 'block';
                console.log('🧪 A/B Test: Showing before/after image (Variant B)');
            }
        });
    }
    
    // Send variant to Google Analytics
    if (typeof gtag === 'function') {
        gtag('event', 'ab_test_variant', {
            'event_category': 'A/B Test',
            'event_label': 'Homepage Image Test',
            'value': variant === 'A' ? 0 : 1,
            'variant': variant
        });
        console.log('🧪 A/B Test: Sent variant to Google Analytics');
    }
})();

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
        
        // Make quiz sticky/modal when user engages
        setTimeout(() => {
            makeQuizSticky();
            showStep(1);
        }, 300);
    }

    function makeQuizSticky() {
        const quizCard = document.getElementById('quizCard');
        const body = document.body;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'quiz-overlay';
        overlay.className = 'quiz-sticky-overlay';
        
        // Add sticky classes
        quizCard.classList.add('quiz-sticky-active');
        body.classList.add('quiz-modal-open');
        
        // Insert overlay before quiz card
        quizCard.parentNode.insertBefore(overlay, quizCard);
        
        console.log('✅ Quiz is now sticky - user locked in!');
    }

    let isSubmitting = false; // Prevent double submissions

    function handleNextStep(stepIndex) {
        // Prevent double-clicks during submission
        if (isSubmitting && stepIndex === 4) {
            console.log("⚠️ Submission already in progress...");
            return;
        }

        const input = getInputForStep(stepIndex);
        if (!input) return;

        const value = input.value.trim();
        
        // Stronger validation: Check for empty values
        if (!value || value.length === 0) {
            input.focus();
            input.style.borderColor = '#ef4444';
            input.placeholder = stepIndex === 1 ? 'Please enter your name' : 
                               stepIndex === 2 ? 'Please enter your zip code' :
                               stepIndex === 3 ? 'Please enter a valid email' :
                               'Please enter your phone number';
            setTimeout(() => {
                input.style.borderColor = '';
                input.placeholder = stepIndex === 1 ? 'Enter your name' : 
                                   stepIndex === 2 ? 'Enter zip code' :
                                   stepIndex === 3 ? 'your@email.com' :
                                   '(607) 123-4567';
            }, 2000);
            return;
        }

        // Name validation for step 1 (at least 2 characters)
        if (stepIndex === 1 && value.length < 2) {
            input.focus();
            input.style.borderColor = '#ef4444';
            input.placeholder = 'Name must be at least 2 characters';
            setTimeout(() => {
                input.style.borderColor = '';
                input.placeholder = 'Enter your name';
            }, 2000);
            return;
        }

        // Zip code validation for step 2
        if (stepIndex === 2) {
            const zipRegex = /^\d{5}$/;
            if (!zipRegex.test(value)) {
                input.focus();
                input.style.borderColor = '#ef4444';
                input.placeholder = 'Please enter a valid 5-digit zip code';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.placeholder = 'Enter zip code';
                }, 2000);
                return;
            }
        }

        // Email validation for step 3
        if (stepIndex === 3) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                input.focus();
                input.style.borderColor = '#ef4444';
                input.placeholder = 'Please enter a valid email';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.placeholder = 'your@email.com';
                }, 2000);
                return;
            }
        }

        // Phone validation for step 4 (basic check)
        if (stepIndex === 4) {
            const phoneRegex = /[\d\(\)\-\s]{10,}/;
            if (!phoneRegex.test(value)) {
                input.focus();
                input.style.borderColor = '#ef4444';
                input.placeholder = 'Please enter a valid phone number';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.placeholder = '(607) 123-4567';
                }, 2000);
                return;
            }
        }

        if (stepIndex === 1) {
            userData.name = value;
            updatePersonalizedMessages(value);
        } else if (stepIndex === 2) {
            userData.zip = value;
        } else if (stepIndex === 3) {
            userData.email = value;
        } else if (stepIndex === 4) {
            userData.phone = value;

            // Set loading state
            isSubmitting = true;
            const btn = document.querySelector('.quiz-btn-next');
            const originalText = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.textContent = '⏳ Submitting...';
            }

            // SEND TO ZAPIER & GOOGLE SHEETS - function is in global scope
            const sendSuccess = sendLeadToZapier(userData);
            
            if (!sendSuccess) {
                // Reset if validation failed
                isSubmitting = false;
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.textContent = originalText;
                }
                console.error("❌ Failed to send lead - validation error");
                alert("There was an error submitting your information. Please check all fields and try again.");
                return;
            }

            // Success - proceed to thank you page
            setTimeout(() => {
                isSubmitting = false;
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.textContent = originalText;
                }
            }, 2000);
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
            2: document.getElementById('userZip'),
            3: document.getElementById('userEmail'),
            4: document.getElementById('userPhone')
        };
        return inputs[stepIndex];
    }

    function updatePersonalizedMessages(name) {
        const step2Title = document.getElementById('step2Title');
        const step3Title = document.getElementById('step3Title');
        const step4Title = document.getElementById('step4Title');

        if (step2Title) step2Title.textContent = `Hi ${name}! What's your zip code?`;
        if (step3Title) step3Title.textContent = `${name}, what's your email?`;
        if (step4Title) step4Title.textContent = `Last step ${name}! What's your phone number?`;
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

        // Log when thank-you page is shown
        if (stepIndex === 5) {
            console.log('📄 Thank you page (Step 5) now visible to user');
            
            // Remove sticky mode on thank you page
            removeQuizSticky();
            
            if (typeof fbq === 'function') {
                fbq('track', 'Lead', {value: 0.00, currency: 'USD'});
                console.log("🔥 REAL Facebook Lead event fired on thank-you step");
            }
        }

        currentStep = stepIndex;
    }

    function removeQuizSticky() {
        const quizCard = document.getElementById('quizCard');
        const overlay = document.getElementById('quiz-overlay');
        const body = document.body;
        
        if (quizCard) {
            quizCard.classList.remove('quiz-sticky-active');
        }
        
        if (overlay) {
            overlay.remove();
        }
        
        body.classList.remove('quiz-modal-open');
        
        console.log('✅ Quiz sticky mode removed - user can scroll freely');
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
