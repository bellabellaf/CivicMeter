;; CivicMeter Assessment Contract
;; Handles tax registration, income updates, tax payments, and admin controls

(define-data-var admin principal tx-sender)

;; Taxpayer data structure
(define-map taxpayer-info
  principal
  {
    income: uint,
    tax-rate: uint,
    last-paid: uint,
    is-registered: bool
  }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-NOT-REGISTERED u101)
(define-constant ERR-ALREADY-REGISTERED u102)
(define-constant ERR-ZERO-INCOME u103)
(define-constant ERR-NOT-DUE u104)

;; Tax rate brackets
(define-constant RATE-LOW u5)
(define-constant RATE-MEDIUM u10)
(define-constant RATE-HIGH u20)

;; Monthly period (approx in seconds)
(define-constant PERIOD-SECONDS u2629743)

;; ---------------------
;; Internal Helpers
;; ---------------------

(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (determine-rate (income uint))
  (if (<= income u5000)
    RATE-LOW
    (if (<= income u20000)
      RATE-MEDIUM
      RATE-HIGH
    )
  )
)

(define-private (now)
  (as-max-int block-height)
)

;; ---------------------
;; Public Functions
;; ---------------------

(define-public (register-taxpayer (entity principal) (income uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> income u0) (err ERR-ZERO-INCOME))
    (match (map-get? taxpayer-info entity)
      some existing (err ERR-ALREADY-REGISTERED)
      none
        (let (
          (rate (determine-rate income))
        )
          (map-set taxpayer-info entity {
            income: income,
            tax-rate: rate,
            last-paid: u0,
            is-registered: true
          })
          (ok true)
        )
    )
  )
)

(define-public (update-income (income uint))
  (begin
    (asserts! (> income u0) (err ERR-ZERO-INCOME))
    (match (map-get? taxpayer-info tx-sender)
      some taxpayer
        (let (
          (rate (determine-rate income))
        )
          (map-set taxpayer-info tx-sender {
            income: income,
            tax-rate: rate,
            last-paid: (get last-paid taxpayer),
            is-registered: true
          })
          (ok true)
        )
      none (err ERR-NOT-REGISTERED)
    )
  )
)

(define-public (pay-tax)
  (begin
    (match (map-get? taxpayer-info tx-sender)
      some taxpayer
        (let (
          (last (get last-paid taxpayer))
          (due (+ last PERIOD-SECONDS))
          (current (as-max-int block-height))
        )
          (asserts! (>= current due) (err ERR-NOT-DUE))
          (map-set taxpayer-info tx-sender {
            income: (get income taxpayer),
            tax-rate: (get tax-rate taxpayer),
            last-paid: current,
            is-registered: true
          })
          (ok (* (get income taxpayer) (get tax-rate taxpayer)))
        )
      none (err ERR-NOT-REGISTERED)
    )
  )
)

(define-read-only (get-tax-details (who principal))
  (match (map-get? taxpayer-info who)
    some data (ok data)
    none (err ERR-NOT-REGISTERED)
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
