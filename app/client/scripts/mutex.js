export class Mutex {
    constructor() {
        this._locked = false;
        this._waiters = [];
    }

    async lock() {
        // Return an unlock function when it's your turn
        const ticket = new Promise(resolve => this._waiters.push(resolve));

        if (!this._locked) {
            this._locked = true;
            // Give the turn to the first waiter immediately
            this._waiters.shift()?.();
        }

        await ticket;

        let released = false;
        return () => {
            if (released) return;
            released = true;
            const next = this._waiters.shift();
            if (next) {
                next();            // hand off lock to next waiter
            } else {
                this._locked = false;
            }
        };
    }
}
