# FizzBuzz in Python using if-else

def fizz_buzz(n):
    """Prints Fizz, Buzz, FizzBuzz, or the number for values from 1 to n."""
    for i in range(1, n + 1):
        if i % 3 == 0 and i % 5 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)

# Main program
try:
    # Get user input
    num = int(input("Enter a positive integer: "))
    
    if num <= 0:
        print("Please enter a number greater than 0.")
    else:
        fizz_buzz(num)

except ValueError:
    print("Invalid input. Please enter an integer.")
