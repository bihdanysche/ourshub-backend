import { IsString, Length, Matches } from "class-validator";

export class RegisterDto {
	@IsString()
	@Length(3, 20)
	@Matches(/^(?!\d+$)[a-zA-Z0-9]+$/)
	username: string;

	@IsString()
	@Length(3, 20)
	nickname: string;

	@IsString()
	@Length(5, 50)
	@Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
		message: "Password must contain letters and numbers",
	})
	password: string;
}
