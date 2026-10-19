import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int w = input.nextInt();
        System.out.println(w > 2 && w % 2 == 0 ? "YES" : "NO");
    }
}
