# Scenario: Calculating the sum of all prime numbers up to a given limit

def is_prime(n):
  """
  Function to check if a number is prime
  """
  if n <= 1:
    return False
  for i in range(2, int(n**0.5) + 1):
    if n % i == 0:
      return False
  return True

def calculate_sum_of_primes(limit):
  """
  Function to calculate the sum of all prime numbers up to a given limit
  """
  prime_sum = 0
  for num in range(2, limit + 1):
    if is_prime(num):
      prime_sum += num
  return prime_sum

# Example usage
limit = 1000000
sum_of_primes = calculate_sum_of_primes(limit)
print(f"The sum of all prime numbers up to {limit} is: {sum_of_primes}")