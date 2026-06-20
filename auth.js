/**
 * CrowdMine Investment - Authentication System
 * Handles user login, registration, and session management
 */

class AuthSystem {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadSession();
    }

    /**
     * Load users from localStorage
     */
    loadUsers() {
        const stored = localStorage.getItem('cm_users');
        return stored ? JSON.parse(stored) : {};
    }

    /**
     * Load current session from localStorage
     */
    loadSession() {
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
        return null;
    }

    /**
     * Save users to localStorage
     */
    saveUsers() {
        localStorage.setItem('cm_users', JSON.stringify(this.users));
    }

    /**
     * Register a new user
     */
    register(email, password, name) {
        // Validate inputs
        if (!email || !password || !name) {
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

        // Create user
        this.users[email] = {
            email,
            password: this.hashPassword(password),
            name,
            createdAt: Date.now(),
            balance: 0,
            totalEarnings: 0,
            referralCode: this.generateReferralCode(),
            verified: false
        };

        this.saveUsers();
        return { success: true, message: 'Registration successful! Please login.' };
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
            totalEarnings: user.totalEarnings
        };

        localStorage.setItem('cm_session', JSON.stringify(session));
        this.currentUser = session;

        return { success: true, message: 'Login successful!' };
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
        }
    }

    /**
     * Simple password hashing (for demo - use proper hashing in production)
     */
    hashPassword(password) {
        return btoa(password);
    }

    /**
     * Generate referral code
     */
    generateReferralCode() {
        return 'REF' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    /**
     * Get user profile
     */
    getUserProfile(email) {
        return this.users[email];
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
}

// Global auth instance
const auth = new AuthSystem();

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
        const userElements = document.querySelectorAll('[data-user-name]');
        userElements.forEach(el => el.textContent = user.name);

        const emailElements = document.querySelectorAll('[data-user-email]');
        emailElements.forEach(el => el.textContent = user.email);

        const balanceElements = document.querySelectorAll('[data-user-balance]');
        balanceElements.forEach(el => el.textContent = '$' + (user.balance || 0).toFixed(2));

        const earningsElements = document.querySelectorAll('[data-user-earnings]');
        earningsElements.forEach(el => el.textContent = '$' + (user.totalEarnings || 0).toFixed(2));

        const referralElements = document.querySelectorAll('[data-user-referral]');
        referralElements.forEach(el => el.textContent = user.referralCode);
    }
}

/**
 * Logout handler
 */
function handleLogout() {
    auth.logout();
    window.location.href = 'login.html';
}

// Display user info on page load
document.addEventListener('DOMContentLoaded', () => {
    if (auth.isLoggedIn()) {
        displayUserInfo();
    }
});
