// =============================================================
//          LEAD SUBMISSION SYSTEM v4.0
// =============================================================

const CONFIG = {
    GOOGLE_SHEETS_WEBHOOK: "https://script.google.com/macros/s/AKfycbzWCQN8AvbRGjtkFy35IAuLhFlpxvUvMgKC79WYhvK0OBmsaehT9aaMAHJ7fwRD87CM/exec",
    ZAPIER_WEBHOOK: "https://hooks.zapier.com/hooks/catch/23450484/u8v689f/",
    DEBUG: true
};

/**
 * Formats phone number to E.164 format (+1XXXXXXXXXX)
 */
function formatPhoneE164(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return '+1' + digits;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return '+' + digits;
    }
    return '+1' + digits; // Fallback
}

/**
 * Splits name into first and last name
 */
function splitName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    return {
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || ''
    };
}

/**
 * Main lead submission function - sends via POST to webhook
 * @param {Object} userData - User data from quiz
 * @returns {Promise<boolean>} - Success status
 */
async function submitLead(userData) {
    // VALIDATION: Ensure all required fields
    const requiredFields = ['name', 'zip', 'email', 'phone'];
    for (const field of requiredFields) {
        if (!userData[field] || !userData[field].trim()) {
            console.error(`❌ BLOCKED: Missing required field: ${field}`, userData);
            return { success: false, error: `Missing required field: ${field}` };
        }
    }

    // Parse name into first/last
    const { first_name, last_name } = splitName(userData.name);

    // Build the payload
    const payload = {
        first_name: first_name,
        last_name: last_name,
        phone: formatPhoneE164(userData.phone),
        email: userData.email.trim().toLowerCase(),
        zip: userData.zip.trim(),
        quiz_answers: JSON.stringify({
            homeowner: userData.homeowner || 'yes',
            ab_variant: window.abTestVariant || 'unknown'
        }),
        page_url: window.location.href,
        timestamp: new Date().toISOString()
    };

    if (CONFIG.DEBUG) {
        console.log('📤 SUBMITTING LEAD VIA POST');
        console.log('Payload:', JSON.stringify(payload, null, 2));
    }

    // Track submission results
    let googleSheetsResult = { success: false, error: null };
    let zapierResult = { success: false, error: null };

    // ========== SEND TO GOOGLE SHEETS (PRIMARY) ==========
    try {
        console.log('📊 Sending to Google Sheets webhook...');
        
        const response = await fetch(CONFIG.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', // Required for Google Apps Script
            },
            body: JSON.stringify(payload)
        });

        console.log(`📊 Google Sheets response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 Google Sheets response:', data);

        if (data.success) {
            googleSheetsResult.success = true;
            console.log('✅ GOOGLE SHEETS: Lead saved successfully');
        } else {
            throw new Error(data.error || 'Unknown error from webhook');
        }
    } catch (error) {
        googleSheetsResult.error = error.message;
        console.error('❌ GOOGLE SHEETS ERROR:', error.message);
    }

    // ========== SEND TO ZAPIER (BACKUP) ==========
    try {
        console.log('⚡ Sending to Zapier webhook...');
        
        const response = await fetch(CONFIG.ZAPIER_WEBHOOK, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        console.log(`⚡ Zapier response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.text();
        console.log('⚡ Zapier response:', data);
        
        zapierResult.success = true;
        console.log('✅ ZAPIER: Lead sent successfully');
    } catch (error) {
        zapierResult.error = error.message;
        console.error('❌ ZAPIER ERROR:', error.message);
    }

    // ========== FINAL STATUS ==========
    const overallSuccess = googleSheetsResult.success || zapierResult.success;

    if (CONFIG.DEBUG) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 SUBMISSION SUMMARY');
        console.log(`   Google Sheets: ${googleSheetsResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (googleSheetsResult.error) console.log(`      Error: ${googleSheetsResult.error}`);
        console.log(`   Zapier: ${zapierResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (zapierResult.error) console.log(`      Error: ${zapierResult.error}`);
        console.log(`   Overall: ${overallSuccess ? '✅ AT LEAST ONE SUCCEEDED' : '❌ ALL FAILED'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // FAIL LOUDLY if both fail
    if (!overallSuccess) {
        console.error('🚨 CRITICAL: BOTH WEBHOOKS FAILED - LEAD NOT SAVED!');
        return { 
            success: false, 
            error: 'Failed to save lead. Please try again or call us directly.',
            details: { googleSheetsResult, zapierResult }
        };
    }

    return { success: true, details: { googleSheetsResult, zapierResult } };
}

// Legacy function for backwards compatibility
function sendLeadToZapier(userData) {
    submitLead(userData);
    return true;
}

console.log("🚀 Script loaded - v4.0 (Enhanced Lead Submission)");

// -------------------------------------------------
//          A/B TEST LOGIC
// -------------------------------------------------

(function initABTest() {
    let variant = localStorage.getItem('ab_test_variant');
    
    if (!variant) {
        variant = Math.random() < 0.5 ? 'A' : 'B';
        localStorage.setItem('ab_test_variant', variant);
        console.log('🧪 A/B Test: New visitor assigned to Variant', variant);
    } else {
        console.log('🧪 A/B Test: Returning visitor - Variant', variant);
    }
    
    window.abTestVariant = variant;
    
    if (variant === 'B') {
        document.addEventListener('DOMContentLoaded', function() {
            const abTestImage = document.getElementById('abTestImage');
            if (abTestImage) {
                abTestImage.style.display = 'block';
                console.log('🧪 A/B Test: Showing before/after image (Variant B)');
            }
        });
    }
    
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
//          QUIZ LOGIC
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
        
        setTimeout(() => {
            makeQuizSticky();
            showStep(1);
        }, 300);
    }

    function makeQuizSticky() {
        const quizCard = document.getElementById('quizCard');
        const body = document.body;
        
        const overlay = document.createElement('div');
        overlay.id = 'quiz-overlay';
        overlay.className = 'quiz-sticky-overlay';
        
        quizCard.classList.add('quiz-sticky-active');
        body.classList.add('quiz-modal-open');
        
        quizCard.parentNode.insertBefore(overlay, quizCard);
        
        console.log('✅ Quiz is now sticky - user locked in!');
    }

    let isSubmitting = false;

    async function handleNextStep(stepIndex) {
        if (isSubmitting && stepIndex === 4) {
            console.log("⚠️ Submission already in progress...");
            return;
        }

        const input = getInputForStep(stepIndex);
        if (!input) return;

        const value = input.value.trim();
        
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

            // SUBMIT LEAD
            const result = await submitLead(userData);
            
            if (!result.success) {
                isSubmitting = false;
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.textContent = originalText;
                }
                console.error("❌ Failed to submit lead:", result.error);
                alert(result.error || "There was an error submitting your information. Please try again or call us directly.");
                return;
            }

            // Success - reset button
            setTimeout(() => {
                isSubmitting = false;
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.textContent = originalText;
                }
            }, 1000);
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

            const input = currentStepEl.querySelector('.quiz-input');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }

            if (window.innerWidth < 768) {
                const quizCard = document.getElementById('quizCard');
                if (quizCard) {
                    quizCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        const footer = document.getElementById('quizFooter');
        if (footer) {
            footer.style.display = stepIndex === 5 ? 'none' : 'block';
        }

        if (stepIndex === 5) {
            console.log('📄 Thank you page (Step 5) now visible to user');
            
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
