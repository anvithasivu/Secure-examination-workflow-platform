#include <stdio.h>

int main() {
    int n;
    long long sum; // Use long long to handle large sums

    // Ask user for input
    printf("Enter a positive integer (n): ");
    
    // Validate input type
    if (scanf("%d", &n) != 1) {
        printf("Invalid input. Please enter an integer.\n");
        return 1; // Exit with error
    }

    // Check if n is a natural number
    if (n <= 0) {
        printf("Error: Please enter a positive integer greater than 0.\n");
    } else {
        // Calculate sum using formula
        sum = (long long)n * (n + 1) / 2;
        printf("Sum of first %d natural numbers is: %lld\n", n, sum);
    }

    return 0;
}
