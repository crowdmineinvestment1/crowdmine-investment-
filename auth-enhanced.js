/**
 * CrowdMine Investment - Enhanced Authentication System with Email OTP
 * Complete user authentication, registration, OTP verification, and session management
 */

class CrowdMineAuth {
    constructor() {
        this.users = this.loadUsers();
        this.otpSessions = this.loadOTPSessions();
        this.currentUser = this.loadSession();
    }

    /**
     * Load users from localStorage
     */
    loadUsers() {
        try {
            const stored = localStorage.getItem('cm_users');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Error loading users:', e);
            return {};
        }
    }

    /**
     * Load OTP sessions from localStorage
     */
    loadOTPSessions() {
        try {
            const stored = localStorage.getItem('cm_otp_sessions');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Error loading OTP sessions:', e);
            return {};
        }
    }

    /**
     * Load current session from localStorage
     */
    loadSession() {
        try {
            const session = localStorage.getItem('cm_session');
            if (session) {
                const user = JSON.parse(session);
                // Check if session expired (24 hours)
                if (Date.now() - user.loginTime < 24 * 60 * 60 * 1000) {
                    return user;
                } else {
                    this.logout();
                    return null;
                }
            }
        } catch (e) {
            console.error('Error loading session:', e);
        }
        return null;
    }

    /**
     * Save users to localStorage
     */
    saveUsers() {
        try {
            localStorage.setItem('cm_users', JSON.stringify(this.users));
        } catch (e) {
            console.error('Error saving users:', e);
        }
    }

    /**
     * Save OTP sessions to localStorage
     */
    saveOTPSessions() {
        try {
            localStorage.setItem('cm_otp_sessions', JSON.stringify(this.otpSessions));
        } catch (e) {
            console.error('Error saving OTP sessions:', e);
        }
    }

    /**
     * Generate and send OTP for registration
     */
    initiateRegistration(email, name, password) {
        // Validate inputs
        if (!email || !name || !password) {
            return { success: false, error: 'All fields are required' };
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { success: false, error: 'Invalid email format' };
        }

        if (password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }

        // Check if user exists
        if (this.users[email]) {
            return { success: false, error: 'Email already registered' };
        }

        // Check for pending registration
        if (this.otpSessions[email]) {
            return { success: false, error: 'OTP already sent to this email. Check your inbox.' };
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store OTP session
        this.otpSessions[email] = {
            otp,
            expiryTime,
            name,
            password: this.hashPassword(password),
            attempts: 0
        };

        this.saveOTPSessions();

        // Simulate email send (in production, use SendGrid, Nodemailer, etc.)
        this.simulateEmailSend(email, otp, name);

        return {
            success: true,
            message: `OTP sent to ${email}. Valid for 10 minutes.`,
            debugOTP: otp // Remove in production
        };
    }

    /**
     * Verify OTP and create account
     */
    verifyOTP(email, otp) {
        if (!email || !otp) {
            return { success: false, error: 'Email and OTP are required' };
        }

        const session = this.otpSessions[email];
        if (!session) {
            return { success: false, error: 'No pending registration found. Please register again.' };
        }

        // Check expiry
        if (Date.now() > session.expiryTime) {
            delete this.otpSessions[email];
            this.saveOTPSessions();
            return { success: false, error: 'OTP expired. Please register again.' };
        }

        // Check attempts (max 5)
        if (session.attempts >= 5) {
            delete this.otpSessions[email];
            this.saveOTPSessions();
            return { success: false, error: 'Too many attempts. Please register again.' };
        }

        // Verify OTP
        if (session.otp !== otp.toString()) {
            session.attempts++;
            this.saveOTPSessions();
            const remaining = 5 - session.attempts;
            return { success: false, error: `Invalid OTP. ${remaining} attempts remaining.` };
        }

        // Create user account
        this.users[email] = {
            email,
            password: session.password,
            name: session.name,
            createdAt: Date.now(),
            verified: true,
            verifiedAt: Date.now(),
            balance: 0,
            totalEarnings: 0,
            referralCode: this.generateReferralCode(),
            status: 'active'
        };

        this.saveUsers();

        // Remove OTP session
        delete this.otpSessions[email];
        this.saveOTPSessions();

        // Auto-login user
        const loginResult = this.login(email, this.unhashPassword(session.password));
        if (loginResult.success) {
            return {
                success: true,
                message: 'Account created and verified successfully!',
                user: this.users[email]
            };
        }

        return loginResult;
    }

    /**
     * Resend OTP
     */
    resendOTP(email) {
        if (!email) {
            return { success: false, error: 'Email is required' };
        }

        const session = this.otpSessions[email];
        if (!session) {
            return { success: false, error: 'No pending registration found.' };
        }

        // Check if OTP was recently sent (wait 30 seconds)
        if (session.sentAt && Date.now() - session.sentAt < 30 * 1000) {
            return { success: false, error: 'Please wait 30 seconds before requesting a new OTP.' };
        }

        // Reset attempts
        session.attempts = 0;
        session.expiryTime = Date.now() + 10 * 60 * 1000;
        session.sentAt = Date.now();

        this.saveOTPSessions();
        this.simulateEmailSend(email, session.otp, session.name);

        return { success: true, message: `OTP resent to ${email}.` };
    }

    /**
     * Login user
     */
    login(email, password) {
        if (!email || !password) {
            return { success: false, error: 'Email and password required' };
        }

        const user = this.users[email];
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (!user.verified) {
            return { success: false, error: 'Email not verified. Please complete registration.' };
        }

        if (user.password !== this.hashPassword(password)) {
            return { success: false, error: 'Invalid password' };
        }

        // Create session
        const session = {
            email: user.email,
            name: user.name,
            referralCode: user.referralCode,
            loginTime: Date.now(),
            balance: user.balance,
            totalEarnings: user.totalEarnings,
            verified: user.verified,
            verifiedEmail: user.email  // IMPORTANT: Store verified email
        };

        localStorage.setItem('cm_session', JSON.stringify(session));
        this.currentUser = session;

        return { success: true, message: 'Login successful!', user: session };
    }

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('cm_session');
        this.currentUser = null;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Update user balance
     */
    updateBalance(email, amount) {
        if (this.users[email]) {
            this.users[email].balance = (this.users[email].balance || 0) + amount;
            this.saveUsers();

            if (this.currentUser && this.currentUser.email === email) {
                this.currentUser.balance = this.users[email].balance;
                localStorage.setItem('cm_session', JSON.stringify(this.currentUser));
            }
            return true;
        }
        return false;
    }

    /**
     * Simple password hashing (for demo - use bcrypt in production)
     */
    hashPassword(password) {
        return btoa(password); // Base64 encoding
    }

    /**
     * Unhash password (for demo only)
     */
    unhashPassword(hash) {
        try {
            return atob(hash);
        } catch (e) {
            return '';
        }
    }

    /**
     * Generate referral code
     */
    generateReferralCode() {
        return 'REF' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    /**
     * Simulate email send (in production, integrate with email service)
     */
    simulateEmailSend(email, otp, name) {
        console.log(`
        ═════════════════════════════════════════
        📧 EMAIL SENT TO: ${email}
        ═════════════════════════════════════════
        Hello ${name}!
        
        Your OTP Code: ${otp}
        Valid for 10 minutes
        
        If you didn't request this, please ignore.
        ═════════════════════════════════════════
        `);
    }

    /**
     * Get user profile
     */
    getUserProfile(email) {
        return this.users[email] || null;
    }

    /**
     * Update user profile
     */
    updateUserProfile(email, updates) {
        if (this.users[email]) {
            this.users[email] = { ...this.users[email], ...updates };
            this.saveUsers();

            if (this.currentUser && this.currentUser.email === email) {
                this.currentUser = { ...this.currentUser, ...updates };
                localStorage.setItem('cm_session', JSON.stringify(this.currentUser));
            }
            return true;
        }
        return false;
    }

    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        return Object.values(this.users);
    }

    /**
     * Update user status (admin only)
     */
    updateUserStatus(email, status) {
        if (this.users[email]) {
            this.users[email].status = status;
            this.saveUsers();
            return true;
        }
        return false;
    }
}

// Global auth instance
const auth = new CrowdMineAuth();

/**
 * Redirect to login if not authenticated
 */
function requireLogin() {
    if (!auth.isLoggedIn()) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    return true;
}

/**
 * Display current user info
 */
function displayUserInfo() {
    const user = auth.getCurrentUser();
    if (user) {
        // Display verified email (not placeholder)
        const userElements = document.querySelectorAll('[data-user-name]');
        userElements.forEach(el => el.textContent = user.name || 'User');

        const emailElements = document.querySelectorAll('[data-user-email]');
        emailElements.forEach(el => el.textContent = user.verifiedEmail || user.email);

        const balanceElements = document.querySelectorAll('[data-user-balance]');
        balanceElements.forEach(el => el.textContent = '$' + (user.balance || 0).toFixed(2));

        const earningsElements = document.querySelectorAll('[data-user-earnings]');
        earningsElements.forEach(el => el.textContent = '$' + (user.totalEarnings || 0).toFixed(2));

        const referralElements = document.querySelectorAll('[data-user-referral]');
        referralElements.forEach(el => el.textContent = user.referralCode || 'N/A');
    }
}

/**
 * Logout handler
 */
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
        window.location.href = 'login.html';
    }
}

// Display user info on page load
document.addEventListener('DOMContentLoaded', () => {
    if (auth.isLoggedIn()) {
        displayUserInfo();
    }
});
